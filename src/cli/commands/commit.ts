/**
 * trail commit command
 *
 * "Smart commit" — reads trajectory chapters/decisions to group changed files
 * into logical commits, then creates them with rich messages derived from
 * the trajectory narrative.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { isGitRepo, isValidGitRef } from "../../core/trace.js";
import {
  TRAJECTORY_TRAILER_KEY,
  getCommitsBetween,
  getFilesChangedBetween,
} from "../../core/trailers.js";
import type { Chapter, Trajectory } from "../../core/types.js";
import { FileStorage, getSearchPaths } from "../../storage/file.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposedCommit {
  files: string[];
  subject: string;
  body?: string;
  trajectoryId: string;
  sourceEvents: string[];
  reasoning: string;
  isOrphan?: boolean;
}

interface CommitResult {
  trajectoryId: string;
  trajectoryTitle: string;
  proposed: ProposedCommit[];
  committed: string[];
  skipped: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerCommitCommand(program: Command): void {
  program
    .command("commit")
    .description(
      "Smart-commit: group uncommitted changes by trajectory chapters and create logical commits",
    )
    .option(
      "--trajectory <id>",
      "Commit changes for a specific trajectory only",
    )
    .option(
      "--base <ref>",
      "Git ref to diff against (default: startRef from each trajectory)",
    )
    .option("--dry-run", "Preview commits without creating them")
    .option("--no-lint", "Skip commit message linting")
    .option("--model <model>", "LLM model for AI-powered commit grouping")
    .option("--ai", "Use AI to group files into commits")
    .action(async (options) => {
      if (!isGitRepo()) {
        console.error("Error: Not in a git repository");
        throw new Error("Not in a git repository");
      }

      const dryRun = options.dryRun ?? false;
      const useAI = options.ai ?? false;
      const results: CommitResult[] = [];

      const trajectories = await findTrajectoriesWithTraces(
        options.trajectory || undefined,
      );

      if (trajectories.length === 0) {
        console.log("No trajectories with uncommitted changes found.");
        console.log(
          'Tip: Start a trajectory with `trail start "Task name"` to begin tracking.',
        );
        return;
      }

      console.log(
        `Found ${trajectories.length} trajectory/trajectories with uncommitted changes.\n`,
      );

      for (const trajectory of trajectories) {
        const result = await processTrajectory(trajectory, options.base, {
          dryRun,
          useAI,
          model: options.model,
          lint: options.lint !== false,
        });
        results.push(result);
      }

      printSummary(results, dryRun);
    });
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function findTrajectoriesWithTraces(
  targetId?: string,
): Promise<Trajectory[]> {
  const trajectories: Trajectory[] = [];
  const seenIds = new Set<string>();
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    const originalDataDir = process.env.TRAJECTORIES_DATA_DIR;
    process.env.TRAJECTORIES_DATA_DIR = searchPath;

    try {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (active?._trace?.startRef && !seenIds.has(active.id)) {
        if (!targetId || active.id === targetId) {
          seenIds.add(active.id);
          trajectories.push(active);
        }
      }

      const completed = await storage.list({
        status: "completed",
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 100,
      });

      for (const summary of completed) {
        if (seenIds.has(summary.id)) continue;
        if (targetId && summary.id !== targetId) continue;
        const full = await storage.get(summary.id);
        if (full?._trace?.startRef) {
          seenIds.add(summary.id);
          trajectories.push(full);
        }
      }
    } finally {
      if (originalDataDir !== undefined) {
        process.env.TRAJECTORIES_DATA_DIR = originalDataDir;
      } else {
        // biome-ignore lint/performance/noDelete: process.env requires delete
        delete process.env.TRAJECTORIES_DATA_DIR;
      }
    }
  }

  return trajectories;
}

async function processTrajectory(
  trajectory: Trajectory,
  baseRefOverride: string,
  opts: { dryRun: boolean; useAI: boolean; model?: string; lint: boolean },
): Promise<CommitResult> {
  const result: CommitResult = {
    trajectoryId: trajectory.id,
    trajectoryTitle: trajectory.task.title,
    proposed: [],
    committed: [],
    skipped: [],
    errors: [],
  };

  const startRef = baseRefOverride || trajectory._trace?.startRef;
  if (!startRef) {
    result.errors.push("No _trace.startRef found");
    return result;
  }

  if (!isValidGitRef(startRef)) {
    result.errors.push(`Invalid start ref: ${startRef}`);
    return result;
  }

  // Get files changed since startRef
  let changedFiles: string[];
  const currentHead = isValidGitRef("HEAD")
    ? execSync("git rev-parse HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    : null;

  if (currentHead && (startRef === "HEAD" || startRef === currentHead)) {
    // No new commits since trajectory started — diff working tree
    try {
      const workingFiles = execSync(`git diff --name-only "${startRef}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
        .trim()
        .split("\n")
        .filter(Boolean);
      const untracked = execSync("git ls-files --others --exclude-standard", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
        .trim()
        .split("\n")
        .filter(Boolean);
      changedFiles = [...new Set([...workingFiles, ...untracked])];
    } catch {
      changedFiles = [];
    }
  } else {
    changedFiles = getFilesChangedBetween(startRef);
  }

  if (changedFiles.length === 0) {
    result.skipped.push("No uncommitted changes since startRef");
    return result;
  }

  console.log(`\n=== ${trajectory.task.title} (${trajectory.id}) ===`);
  console.log(
    `Changed files (${changedFiles.length}): ${changedFiles.slice(0, 5).join(", ")}${changedFiles.length > 5 ? " ..." : ""}`,
  );

  const commits = opts.useAI
    ? await groupFilesWithAI(trajectory, changedFiles, opts.model)
    : groupFilesNaive(trajectory, changedFiles);

  result.proposed = commits;

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const label = opts.dryRun
      ? "[DRY-RUN] Would commit"
      : `[${i + 1}/${commits.length}] Commit`;
    console.log(`\n${label}:`);
    console.log(`  Subject: ${c.subject}`);
    if (c.body) console.log(`  Body: ${c.body.split("\n")[0]}`);
    console.log(`  Files: ${c.files.join(", ")}`);
    console.log(`  Reason: ${c.reasoning}`);
  }

  if (opts.dryRun) {
    console.log("\n(Dry run — no commits were created)");
    return result;
  }

  for (const commit of commits) {
    try {
      const hash = await createCommit(trajectory, commit);
      result.committed.push(hash);
      console.log(
        `\n✓ Created commit: ${hash.slice(0, 8)} — ${commit.subject}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to commit "${commit.subject}": ${msg}`);
      console.error(`\n✗ Failed: ${msg}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// File grouping
// ---------------------------------------------------------------------------

function groupFilesNaive(
  trajectory: Trajectory,
  files: string[],
): ProposedCommit[] {
  const commits: ProposedCommit[] = [];

  const isUserFile = (f: string) =>
    !f.startsWith(".trajectories/") &&
    !f.includes("/.trajectories/") &&
    f !== "index.json";

  const userFiles = files.filter(isUserFile);
  const metaFiles = files.filter((f) => !isUserFile(f));

  if (trajectory.chapters.length > 0) {
    const chapterFiles = new Map<string, string[]>();
    const ungrouped: string[] = [];

    for (const file of userFiles) {
      let grouped = false;
      for (const chapter of trajectory.chapters) {
        const matched = chapter.events.some((e) => {
          if (e.type !== "tool_call") return false;
          const raw = e.raw;
          if (typeof raw === "string") {
            const rawBasename = raw.split("/").pop() || raw;
            return (
              file === raw ||
              file.endsWith(`/${raw}`) ||
              raw.endsWith(`/${file}`) ||
              file === rawBasename ||
              file.endsWith(`/${rawBasename}`)
            );
          }
          return false;
        });
        if (matched) {
          if (!chapterFiles.has(chapter.id)) chapterFiles.set(chapter.id, []);
          chapterFiles.get(chapter.id)!.push(file);
          grouped = true;
          break;
        }
      }
      if (!grouped) ungrouped.push(file);
    }

    for (const chapter of trajectory.chapters) {
      const chapterFilesList = chapterFiles.get(chapter.id) || [];
      if (chapterFilesList.length === 0) continue;

      commits.push({
        files: chapterFilesList,
        subject: makeSubject(chapter.title, trajectory.task.title),
        body: makeBody(chapter),
        trajectoryId: trajectory.id,
        sourceEvents: chapter.events
          .filter((e) => e.type === "decision" || e.type === "finding")
          .map((e) => e.content),
        reasoning: `Chapter "${chapter.title}": ${chapterFilesList.join(", ")}`,
        isOrphan: false,
      });
    }

    if (ungrouped.length > 0) {
      commits.push({
        files: ungrouped,
        subject: makeSubject("Other changes", trajectory.task.title),
        trajectoryId: trajectory.id,
        sourceEvents: [],
        reasoning: "Files not matched to any chapter",
        isOrphan: true,
      });
    }
  } else {
    commits.push({
      files: userFiles,
      subject: makeSubject(trajectory.task.title, trajectory.task.title),
      body: trajectory.retrospective?.summary,
      trajectoryId: trajectory.id,
      sourceEvents: [],
      reasoning: "Single commit (no chapters)",
    });

    if (metaFiles.length > 0) {
      commits.push({
        files: metaFiles,
        subject: "chore: update trajectory metadata",
        trajectoryId: trajectory.id,
        sourceEvents: [],
        reasoning: "Trajectory infrastructure files",
        isOrphan: true,
      });
    }
  }

  return commits;
}

async function groupFilesWithAI(
  trajectory: Trajectory,
  files: string[],
  _model?: string,
): Promise<ProposedCommit[]> {
  const chapters = trajectory.chapters
    .map((c) => {
      const events = c.events
        .filter(
          (e) =>
            e.type === "decision" || e.type === "note" || e.type === "finding",
        )
        .map((e) => `  [${e.type}] ${e.content}`)
        .join("\n");
      return `## Chapter: ${c.title}\n${events || "  (no notable events)"}`;
    })
    .join("\n\n");

  const retrospective = trajectory.retrospective
    ? `Summary: ${trajectory.retrospective.summary}\nApproach: ${trajectory.retrospective.approach}`
    : "No retrospective completed yet.";

  const prompt = `You are helping group changed files into logical git commits for a trajectory-based workflow.

TRAJECTORY CONTEXT:
- Task: ${trajectory.task.title}
- ${retrospective}

CHAPTERS:
${chapters}

CHANGED FILES (${files.length}):
${files.map((f) => `- ${f}`).join("\n")}

YOUR JOB:
Analyze the trajectory narrative and changed files. Group the files into 1-5 logical commits.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "commits": [
    {
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "subject": "type: short description",
      "reasoning": "why these files go together"
    }
  ]
}

Rules:
- Use conventional commit format (feat:, fix:, docs:, refactor:, test:, chore:, etc.)
- Maximum 5 commits total
- Each commit must have at least 1 file
- All changed files must appear in exactly one commit
- Return ONLY the JSON, nothing else`;

  try {
    const response = await callLLM(prompt);
    const parsed = JSON.parse(response);
    return parsed.commits.map(
      (c: { files: string[]; subject: string; reasoning: string }) => ({
        ...c,
        trajectoryId: trajectory.id,
        sourceEvents: [],
        body: undefined,
        isOrphan: false,
      }),
    );
  } catch {
    console.warn("Warning: AI grouping failed, falling back to naive grouping");
    return groupFilesNaive(trajectory, files);
  }
}

async function callLLM(prompt: string): Promise<string> {
  const tools = [
    { cmd: "opencode", args: ["run", prompt] },
    { cmd: "codex", args: ["exec", prompt] },
    { cmd: "claude", args: ["-p", prompt] },
  ];

  for (const tool of tools) {
    try {
      const result = execSync(tool.cmd, {
        args: tool.args,
        encoding: "utf-8",
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const trimmed = result.trim();
      if (trimmed) return trimmed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("not logged in") ||
        msg.includes("401") ||
        msg.includes("auth")
      ) {
        console.warn(`Warning: ${tool.cmd} auth failed, trying next...`);
      }
    }
  }

  throw new Error(
    "No working LLM CLI found. Install opencode, codex, or claude.",
  );
}

// ---------------------------------------------------------------------------
// Git operations
// ---------------------------------------------------------------------------

async function createCommit(
  trajectory: Trajectory,
  commit: ProposedCommit,
): Promise<string> {
  if (commit.files.length === 0) {
    return "(no files to commit)";
  }

  // Reset staging area to HEAD, then stage only the files for this commit.
  // This prevents files from previous staging batches from being accidentally committed.
  try {
    execSync("git reset HEAD --quiet", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // Ignore reset errors (e.g., if there are no commits yet)
  }

  execSync(
    `git add ${commit.files.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(" ")}`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );

  const staged = execSync("git diff --cached --name-only", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  if (!staged) {
    return "(already committed)";
  }

  let message = commit.subject;
  if (commit.body) message += `\n\n${commit.body}`;
  if (commit.sourceEvents.length > 0) {
    message += `\n\nDecisions:\n${commit.sourceEvents.map((e) => `- ${e}`).join("\n")}`;
  }
  message += `\n\n${TRAJECTORY_TRAILER_KEY}: ${trajectory.id}`;

  const tmpDir = mkdtempSync("/tmp/trail-commit-");
  const msgPath = join(tmpDir, "msg");
  writeFileSync(msgPath, `${message}\n`, "utf-8");

  try {
    return execSync(`git commit -F "${msgPath}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err: unknown) {
    const execErr = err as {
      status?: number;
      stderr?: string;
      message?: string;
    };
    const stderr = execErr.stderr || "";
    const status = execErr.status;
    throw new Error(
      `git commit failed (status ${status}): ${stderr || execErr.message || "unknown error"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubject(prefix: string, taskTitle: string): string {
  const prefixLower = prefix.toLowerCase();
  let type = "chore";
  if (prefixLower.includes("fix") || prefixLower.includes("bug")) type = "fix";
  else if (prefixLower.includes("feat") || prefixLower.includes("add"))
    type = "feat";
  else if (prefixLower.includes("test")) type = "test";
  else if (prefixLower.includes("doc")) type = "docs";
  else if (prefixLower.includes("refactor")) type = "refactor";

  const cleanPrefix = prefix.replace(
    /^(feat|fix|docs|test|refactor|chore):\s*/i,
    "",
  );
  return `${type}: ${cleanPrefix || taskTitle.slice(0, 50)}`;
}

function makeBody(chapter: Chapter): string {
  const decisions = chapter.events
    .filter((e) => e.type === "decision")
    .map((e) => e.content)
    .join("\n");
  const notes = chapter.events
    .filter((e) => e.type === "note" || e.type === "finding")
    .slice(0, 3)
    .map((e) => e.content)
    .join("\n");
  let body = "";
  if (decisions) body += `Decisions:\n${decisions}\n`;
  if (notes) body += `Notes:\n${notes}\n`;
  return body.trim();
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printSummary(results: CommitResult[], dryRun: boolean): void {
  const totalProposed = results.reduce((sum, r) => sum + r.proposed.length, 0);
  const totalCommitted = results.reduce(
    (sum, r) => sum + r.committed.length,
    0,
  );
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\n${"=".repeat(60)}`);
  if (dryRun) {
    console.log(`DRY RUN — ${totalProposed} commits would be created`);
  } else {
    console.log(`✓ Created ${totalCommitted} commit(s)`);
  }
  if (totalErrors > 0) console.log(`✗ ${totalErrors} error(s)`);

  for (const result of results) {
    for (const err of result.errors) {
      console.log(`\n! ${result.trajectoryId}: ${err}`);
    }
  }
}
