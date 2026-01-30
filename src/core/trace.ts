/**
 * Agent Trace generation logic
 *
 * Captures git state before and after agent work to generate
 * trace records that attribute code contributions to agents.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { generateRandomId } from "./id.js";
import type {
  TraceFile,
  TraceRange,
  TraceRecord,
  Trajectory,
  TrajectoryTraceRef,
} from "./types.js";

/**
 * Check if the current directory is inside a git repository
 * @returns True if in a git repo, false otherwise
 */
export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git HEAD reference
 * @returns The current HEAD commit hash, or null if not in a git repo
 */
export function getGitHead(): string | null {
  if (!isGitRepo()) {
    return null;
  }

  try {
    const head = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return head;
  } catch {
    return null;
  }
}

/**
 * Capture the current git state for trace tracking
 * @returns The start reference (commit hash) or null if not in git repo
 */
export function captureGitState(): string | null {
  return getGitHead();
}

/**
 * Parse git diff output to extract changed files and line ranges
 * @param diffOutput - Raw git diff output
 * @returns Array of file paths with their changed line ranges
 */
function parseDiffOutput(
  diffOutput: string,
): Array<{ path: string; ranges: TraceRange[] }> {
  const files: Array<{ path: string; ranges: TraceRange[] }> = [];
  const lines = diffOutput.split("\n");

  let currentFile: string | null = null;
  let currentRanges: TraceRange[] = [];

  for (const line of lines) {
    // Match diff header for file path
    // Format: diff --git a/path/to/file b/path/to/file
    const diffHeaderMatch = line.match(/^diff --git a\/.+ b\/(.+)$/);
    if (diffHeaderMatch) {
      // Save previous file if exists
      if (currentFile) {
        files.push({ path: currentFile, ranges: currentRanges });
      }
      currentFile = diffHeaderMatch[1];
      currentRanges = [];
      continue;
    }

    // Match hunk header for line ranges
    // Format: @@ -start,count +start,count @@ optional context
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      const startLine = Number.parseInt(hunkMatch[1], 10);
      const lineCount = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1;

      if (lineCount > 0) {
        currentRanges.push({
          start_line: startLine,
          end_line: startLine + lineCount - 1,
        });
      }
    }
  }

  // Don't forget the last file
  if (currentFile) {
    files.push({ path: currentFile, ranges: currentRanges });
  }

  return files;
}

/**
 * Get the list of changed files between two git refs
 * @param startRef - Starting commit reference
 * @param endRef - Ending commit reference (defaults to HEAD)
 * @returns Array of changed file paths with line ranges
 */
export function getChangedFiles(
  startRef: string,
  endRef = "HEAD",
): Array<{ path: string; ranges: TraceRange[] }> {
  if (!isGitRepo()) {
    return [];
  }

  try {
    const diffOutput = execSync(`git diff ${startRef}..${endRef}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    });

    return parseDiffOutput(diffOutput);
  } catch {
    return [];
  }
}

/**
 * Detect the model from environment variables
 * @returns Model identifier or 'unknown'
 */
export function detectModel(): string {
  // Check custom env var first
  if (process.env.TRAIL_TRACE_MODEL) {
    return process.env.TRAIL_TRACE_MODEL;
  }

  // Check Anthropic model env var
  if (process.env.ANTHROPIC_MODEL) {
    return process.env.ANTHROPIC_MODEL;
  }

  // Check common AI provider model env vars
  if (process.env.OPENAI_MODEL) {
    return process.env.OPENAI_MODEL;
  }

  return "unknown";
}

/**
 * Generate a unique trace ID
 * Format: trace_xxxxxxxxxxxx
 * @returns Unique trace ID
 */
export function generateTraceId(): string {
  return `trace_${generateRandomId()}`;
}

/**
 * Compute content hash for a given string
 * @param content - Content to hash
 * @returns SHA-256 hash (first 16 chars)
 */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Generate a trace record from a trajectory and git state
 * @param trajectory - The trajectory to generate trace for
 * @param startRef - The git ref from when work started
 * @returns TraceRecord with file contributions, or null if not in git repo
 */
export function generateTrace(
  trajectory: Trajectory,
  startRef: string,
): TraceRecord | null {
  if (!isGitRepo()) {
    return null;
  }

  const endRef = getGitHead();
  if (!endRef) {
    return null;
  }

  // Get changed files with line ranges
  const changedFiles = getChangedFiles(startRef, endRef);

  // Detect the model used
  const model = detectModel();

  // Build trace files
  const traceFiles: TraceFile[] = changedFiles.map(({ path, ranges }) => ({
    path,
    conversations: [
      {
        contributor: {
          type: "agent",
          model,
        },
        ranges: ranges.map((range) => ({
          ...range,
          revision: endRef,
        })),
      },
    ],
  }));

  return {
    version: 1,
    id: generateTraceId(),
    timestamp: new Date().toISOString(),
    trajectory: trajectory.id,
    files: traceFiles,
  };
}

/**
 * Create a trace reference for embedding in a trajectory
 * @param startRef - Git ref when trace started
 * @param traceId - Optional ID of the generated trace record
 * @returns TrajectoryTraceRef object
 */
export function createTraceRef(
  startRef: string,
  traceId?: string,
): TrajectoryTraceRef {
  const endRef = getGitHead();

  return {
    startRef,
    endRef: endRef ?? undefined,
    traceId,
  };
}
