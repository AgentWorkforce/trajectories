/**
 * Git trailer utilities for linking commits to trajectories
 *
 * Appends structured metadata to commit messages using git's trailer convention:
 *   Trajectory: traj_xxxxxxxxxxxx
 *
 * This creates a bidirectional link: trajectories reference commits,
 * and commits reference trajectories.
 */

import { execSync } from "node:child_process";
import { isGitRepo, isValidGitRef } from "./trace.js";

/** Trailer key for trajectory ID */
export const TRAJECTORY_TRAILER_KEY = "Trajectory";

/**
 * Format a trajectory trailer for appending to a commit message
 * @param trajectoryId - The trajectory ID to link
 * @returns Formatted trailer string (e.g., "Trajectory: traj_abc123")
 */
export function formatTrailer(trajectoryId: string): string {
  return `${TRAJECTORY_TRAILER_KEY}: ${trajectoryId}`;
}

/**
 * Parse trajectory ID from a commit message's trailers
 * @param commitMessage - Full commit message text
 * @returns The trajectory ID if found, null otherwise
 */
export function parseTrajectoryFromMessage(
  commitMessage: string,
): string | null {
  const lines = commitMessage.split("\n");
  for (const line of lines) {
    const match = line.match(
      new RegExp(`^${TRAJECTORY_TRAILER_KEY}:\\s*(traj_[a-z0-9]+)$`),
    );
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Get the trajectory ID linked to a specific commit
 * @param commitHash - Git commit hash
 * @returns The trajectory ID if found, null otherwise
 */
export function getTrajectoryFromCommit(commitHash: string): string | null {
  if (!isGitRepo() || !isValidGitRef(commitHash)) {
    return null;
  }

  try {
    const message = execSync(`git log -1 --format=%B ${commitHash}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseTrajectoryFromMessage(message);
  } catch {
    return null;
  }
}

/**
 * Commit info returned by getCommitsBetween
 */
export interface CommitInfo {
  /** Short commit hash */
  hash: string;
  /** Full commit hash */
  fullHash: string;
  /** Commit subject line */
  subject: string;
  /** Commit author */
  author: string;
  /** Commit timestamp (ISO) */
  date: string;
}

/**
 * Get all commits between two git refs
 * @param startRef - Starting commit (exclusive)
 * @param endRef - Ending commit (inclusive, defaults to HEAD)
 * @returns Array of commit info objects
 */
export function getCommitsBetween(
  startRef: string,
  endRef = "HEAD",
): CommitInfo[] {
  if (!isGitRepo()) {
    return [];
  }

  if (!isValidGitRef(startRef) || !isValidGitRef(endRef)) {
    return [];
  }

  try {
    const output = execSync(
      `git log --format=%H%n%h%n%s%n%an%n%aI%n--- ${startRef}..${endRef}`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    if (!output.trim()) {
      return [];
    }

    const commits: CommitInfo[] = [];
    const entries = output.trim().split("\n---\n");

    for (const entry of entries) {
      const lines = entry.trim().split("\n");
      if (lines.length >= 5) {
        commits.push({
          fullHash: lines[0],
          hash: lines[1],
          subject: lines[2],
          author: lines[3],
          date: lines[4],
        });
      }
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Get file paths changed between two git refs
 * @param startRef - Starting commit (exclusive)
 * @param endRef - Ending commit (inclusive, defaults to HEAD)
 * @returns Array of changed file paths
 */
export function getFilesChangedBetween(
  startRef: string,
  endRef = "HEAD",
): string[] {
  if (!isGitRepo()) {
    return [];
  }

  if (!isValidGitRef(startRef) || !isValidGitRef(endRef)) {
    return [];
  }

  try {
    const output = execSync(
      `git diff --name-only ${startRef}..${endRef}`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    return output
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Generate the content of a prepare-commit-msg hook script
 * that appends trajectory trailers to commits
 */
export function generateHookScript(): string {
  return `#!/bin/sh
# Added by agent-trajectories - appends Trajectory trailer to commits
# This hook reads the active trajectory and links it to your commit.

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Skip for merge, squash, and amend commits
if [ "$COMMIT_SOURCE" = "merge" ] || [ "$COMMIT_SOURCE" = "squash" ]; then
  exit 0
fi

# Find the trajectories data directory
TRAJ_DIR="\${TRAJECTORIES_DATA_DIR:-\$(git rev-parse --show-toplevel)/.trajectories}"
ACTIVE_DIR="$TRAJ_DIR/active"

# Check if there's an active trajectory
if [ ! -d "$ACTIVE_DIR" ]; then
  exit 0
fi

# Find the most recent active trajectory file
ACTIVE_FILE=$(ls -t "$ACTIVE_DIR"/*.json 2>/dev/null | head -1)
if [ -z "$ACTIVE_FILE" ]; then
  exit 0
fi

# Extract trajectory ID (grep for the "id" field)
TRAJ_ID=$(grep -o '"id"[[:space:]]*:[[:space:]]*"traj_[a-z0-9]*"' "$ACTIVE_FILE" | head -1 | grep -o 'traj_[a-z0-9]*')
if [ -z "$TRAJ_ID" ]; then
  exit 0
fi

# Check if trailer already exists in the message
if grep -q "^Trajectory: " "$COMMIT_MSG_FILE" 2>/dev/null; then
  exit 0
fi

# Append the trailer with a blank line separator
echo "" >> "$COMMIT_MSG_FILE"
echo "Trajectory: $TRAJ_ID" >> "$COMMIT_MSG_FILE"
`;
}

/**
 * Check if a prepare-commit-msg hook already exists and contains our marker
 * @returns 'none' if no hook exists, 'ours' if our hook, 'other' if different hook
 */
export function detectExistingHook(): "none" | "ours" | "other" {
  if (!isGitRepo()) {
    return "none";
  }

  try {
    const hooksDir = execSync("git rev-parse --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const hookPath = `${hooksDir}/hooks/prepare-commit-msg`;

    try {
      const content = execSync(`cat ${hookPath}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (content.includes("agent-trajectories")) {
        return "ours";
      }
      return "other";
    } catch {
      return "none";
    }
  } catch {
    return "none";
  }
}
