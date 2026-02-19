/**
 * trail compact command
 *
 * Compresses multiple trajectories into a single compacted summary.
 * Useful for reducing context after PR merges by organizing similar
 * decisions into grouped, understandable summaries.
 *
 * Default behavior: compact only trajectories that haven't been compacted yet.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import type {
  Decision,
  Trajectory,
} from "../../core/types.js";
import { FileStorage, getSearchPaths } from "../../storage/file.js";
import { generateRandomId } from "../../core/id.js";

/**
 * A group of related decisions
 */
interface DecisionGroup {
  category: string;
  decisions: Array<{
    question: string;
    chosen: string;
    reasoning: string;
    fromTrajectory: string;
  }>;
}

/**
 * Compacted trajectory summary
 */
interface CompactedTrajectory {
  id: string;
  version: 1;
  type: "compacted";
  compactedAt: string;
  sourceTrajectories: string[];
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalDecisions: number;
    totalEvents: number;
    uniqueAgents: string[];
  };
  decisionGroups: DecisionGroup[];
  keyLearnings: string[];
  keyFindings: string[];
  filesAffected: string[];
  commits: string[];
}

/**
 * Index entry with compaction tracking
 */
interface IndexEntry {
  title: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  path: string;
  compactedInto?: string;
}

export function registerCompactCommand(program: Command): void {
  program
    .command("compact")
    .description("Compact trajectories into a summarized form (default: uncompacted only)")
    .option(
      "--since <date>",
      "Include trajectories since this date (ISO format or relative like '7d')",
    )
    .option(
      "--until <date>",
      "Include trajectories until this date (ISO format)",
    )
    .option("--ids <ids>", "Comma-separated list of trajectory IDs to compact")
    .option("--pr <number>", "Compact trajectories associated with a PR number")
    .option(
      "--branch <name>",
      "Compact trajectories with commits not in the specified branch (e.g., main)",
    )
    .option("--all", "Include all trajectories, even previously compacted ones")
    .option("--dry-run", "Preview what would be compacted without saving")
    .option("--output <path>", "Output path for compacted trajectory")
    .action(async (options) => {
      const trajectories = await loadTrajectories(options);

      if (trajectories.length === 0) {
        if (options.all || options.since || options.ids || options.pr || options.branch) {
          console.log("No trajectories found matching criteria");
        } else {
          console.log("No uncompacted trajectories found. Use --all to include previously compacted.");
        }
        return;
      }

      console.log(`Compacting ${trajectories.length} trajectories...\n`);

      const compacted = compactTrajectories(trajectories);

      if (options.dryRun) {
        console.log("=== DRY RUN - Preview ===\n");
        printCompactedSummary(compacted);
        return;
      }

      // Save the compacted trajectory
      const outputPath = options.output || getDefaultOutputPath(compacted);
      saveCompactedTrajectory(compacted, outputPath);

      // Mark source trajectories as compacted
      await markTrajectoriesAsCompacted(trajectories, compacted.id);

      console.log(`\nCompacted trajectory saved to: ${outputPath}`);
      printCompactedSummary(compacted);
    });
}

async function loadTrajectories(options: {
  since?: string;
  until?: string;
  ids?: string;
  pr?: string;
  branch?: string;
  all?: boolean;
}): Promise<Trajectory[]> {
  const trajectories: Trajectory[] = [];
  const targetIds = options.ids ? options.ids.split(",").map((s) => s.trim()) : null;

  // Parse date filters
  const sinceDate = options.since ? parseRelativeDate(options.since) : null;
  const untilDate = options.until ? new Date(options.until) : null;

  // Get commits on current branch not in target branch
  const branchCommits = options.branch ? getBranchCommits(options.branch) : null;

  // Get compaction state from index
  const compactedIds = options.all ? new Set<string>() : getCompactedTrajectoryIds();

  const searchPaths = getSearchPaths();
  const seenIds = new Set<string>();

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    const originalDataDir = process.env.TRAJECTORIES_DATA_DIR;
    process.env.TRAJECTORIES_DATA_DIR = searchPath;

    try {
      const storage = new FileStorage();
      await storage.initialize();

      const summaries = await storage.list({ status: "completed" });

      for (const summary of summaries) {
        if (seenIds.has(summary.id)) continue;

        // Skip already compacted (unless --all)
        if (compactedIds.has(summary.id)) continue;

        // Filter by IDs if specified
        if (targetIds && !targetIds.includes(summary.id)) continue;

        // Filter by date range
        const startDate = new Date(summary.startedAt);
        if (sinceDate && startDate < sinceDate) continue;
        if (untilDate && startDate > untilDate) continue;

        // Load full trajectory
        const trajectory = await storage.get(summary.id);
        if (trajectory) {
          seenIds.add(summary.id);

          // Filter by PR if specified
          if (options.pr) {
            const prPattern = new RegExp(`#${options.pr}\\b|PR.*${options.pr}`, "i");
            const matchesPR =
              prPattern.test(trajectory.task.title) ||
              prPattern.test(trajectory.task.description || "") ||
              trajectory.commits.some((c) => prPattern.test(c));

            if (!matchesPR) continue;
          }

          // Filter by branch if specified
          if (branchCommits) {
            const hasMatchingCommit = trajectory.commits.some((c) =>
              branchCommits.has(c.slice(0, 7)) || branchCommits.has(c)
            );
            if (!hasMatchingCommit && trajectory.commits.length > 0) continue;
            // Include trajectories with no commits (they might still be relevant)
          }

          trajectories.push(trajectory);
        }
      }
    } finally {
      if (originalDataDir !== undefined) {
        process.env.TRAJECTORIES_DATA_DIR = originalDataDir;
      } else {
        process.env.TRAJECTORIES_DATA_DIR = undefined;
      }
    }
  }

  return trajectories;
}

/**
 * Get commits that are on the current branch but not in the target branch
 */
function getBranchCommits(targetBranch: string): Set<string> {
  const commits = new Set<string>();

  try {
    // Get commits on HEAD that are not in target branch
    const output = execSync(`git log ${targetBranch}..HEAD --format=%H`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    for (const line of output.trim().split("\n")) {
      if (line) {
        commits.add(line);
        commits.add(line.slice(0, 7)); // Also add short hash
      }
    }
  } catch {
    // Not in a git repo or branch doesn't exist
    console.warn(`Warning: Could not get commits for branch comparison with ${targetBranch}`);
  }

  return commits;
}

/**
 * Get IDs of trajectories that have already been compacted
 */
function getCompactedTrajectoryIds(): Set<string> {
  const compacted = new Set<string>();
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    const indexPath = join(searchPath, "index.json");
    if (!existsSync(indexPath)) continue;

    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const index = JSON.parse(indexContent) as {
        trajectories: Record<string, IndexEntry>;
      };

      for (const [id, entry] of Object.entries(index.trajectories || {})) {
        if (entry.compactedInto) {
          compacted.add(id);
        }
      }
    } catch {
      // Index doesn't exist or is malformed
    }
  }

  return compacted;
}

/**
 * Mark trajectories as having been compacted into a specific compaction
 */
async function markTrajectoriesAsCompacted(
  trajectories: Trajectory[],
  compactedIntoId: string,
): Promise<void> {
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    const indexPath = join(searchPath, "index.json");
    if (!existsSync(indexPath)) continue;

    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const index = JSON.parse(indexContent) as {
        version: number;
        lastUpdated: string;
        trajectories: Record<string, IndexEntry>;
      };

      let updated = false;
      for (const traj of trajectories) {
        if (index.trajectories[traj.id]) {
          index.trajectories[traj.id].compactedInto = compactedIntoId;
          updated = true;
        }
      }

      if (updated) {
        index.lastUpdated = new Date().toISOString();
        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }
    } catch {
      // Index doesn't exist or is malformed
    }
  }
}

function parseRelativeDate(input: string): Date {
  // Handle relative dates like "7d", "2w", "1m"
  const match = input.match(/^(\d+)([dwmh])$/);
  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case "h":
        return new Date(now.getTime() - amount * 60 * 60 * 1000);
      case "d":
        return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
      case "w":
        return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Otherwise try to parse as ISO date
  return new Date(input);
}

function compactTrajectories(trajectories: Trajectory[]): CompactedTrajectory {
  const allDecisions: Array<{
    decision: Decision;
    fromTrajectory: string;
    timestamp: number;
  }> = [];
  const allLearnings: string[] = [];
  const allFindings: string[] = [];
  const allFiles = new Set<string>();
  const allCommits = new Set<string>();
  const allAgents = new Set<string>();
  let totalEvents = 0;

  // Extract data from all trajectories
  for (const traj of trajectories) {
    // Collect agents
    for (const agent of traj.agents) {
      allAgents.add(agent.name);
    }

    // Collect files and commits
    for (const file of traj.filesChanged) {
      allFiles.add(file);
    }
    for (const commit of traj.commits) {
      allCommits.add(commit);
    }

    // Extract decisions from chapters
    for (const chapter of traj.chapters) {
      totalEvents += chapter.events.length;

      for (const event of chapter.events) {
        if (event.type === "decision" && event.raw) {
          const decision = event.raw as Decision;
          allDecisions.push({
            decision,
            fromTrajectory: traj.id,
            timestamp: event.ts,
          });
        }

        if (event.type === "finding" && event.content) {
          allFindings.push(event.content);
        }
      }
    }

    // Extract learnings from retrospective
    if (traj.retrospective?.learnings) {
      allLearnings.push(...traj.retrospective.learnings);
    }

    // Also extract decisions from retrospective
    if (traj.retrospective?.decisions) {
      for (const decision of traj.retrospective.decisions) {
        allDecisions.push({
          decision,
          fromTrajectory: traj.id,
          timestamp: new Date(traj.completedAt || traj.startedAt).getTime(),
        });
      }
    }
  }

  // Group decisions by category/topic
  const decisionGroups = groupDecisions(allDecisions);

  // Dedupe learnings
  const uniqueLearnings = [...new Set(allLearnings)];

  // Calculate date range
  const dates = trajectories.map((t) => new Date(t.startedAt).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(
    Math.max(...trajectories.map((t) => new Date(t.completedAt || t.startedAt).getTime())),
  );

  return {
    id: `compact_${generateRandomId()}`,
    version: 1,
    type: "compacted",
    compactedAt: new Date().toISOString(),
    sourceTrajectories: trajectories.map((t) => t.id),
    dateRange: {
      start: minDate.toISOString(),
      end: maxDate.toISOString(),
    },
    summary: {
      totalDecisions: allDecisions.length,
      totalEvents,
      uniqueAgents: [...allAgents],
    },
    decisionGroups,
    keyLearnings: uniqueLearnings,
    keyFindings: [...new Set(allFindings)],
    filesAffected: [...allFiles],
    commits: [...allCommits],
  };
}

function groupDecisions(
  decisions: Array<{
    decision: Decision;
    fromTrajectory: string;
    timestamp: number;
  }>,
): DecisionGroup[] {
  // Simple categorization based on keywords in the question/reasoning
  const categories: Record<string, DecisionGroup> = {};

  const categoryKeywords: Record<string, string[]> = {
    architecture: ["architecture", "structure", "pattern", "design", "module", "component"],
    api: ["api", "endpoint", "rest", "graphql", "http", "request", "response"],
    database: ["database", "schema", "migration", "query", "sql", "model"],
    testing: ["test", "spec", "coverage", "assertion", "mock"],
    security: ["security", "auth", "permission", "token", "credential", "encrypt"],
    performance: ["performance", "optimize", "cache", "speed", "memory"],
    tooling: ["tool", "config", "build", "lint", "format", "ci", "cd"],
    naming: ["name", "rename", "convention", "format"],
    compliance: ["spec", "standard", "compliance", "convention", "align"],
  };

  for (const { decision, fromTrajectory } of decisions) {
    const text = `${decision.question} ${decision.reasoning}`.toLowerCase();

    let matchedCategory = "other";
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        matchedCategory = category;
        break;
      }
    }

    if (!categories[matchedCategory]) {
      categories[matchedCategory] = {
        category: matchedCategory,
        decisions: [],
      };
    }

    categories[matchedCategory].decisions.push({
      question: decision.question,
      chosen: decision.chosen,
      reasoning: decision.reasoning,
      fromTrajectory,
    });
  }

  // Sort categories by number of decisions
  return Object.values(categories).sort(
    (a, b) => b.decisions.length - a.decisions.length,
  );
}

function getDefaultOutputPath(compacted: CompactedTrajectory): string {
  const trajDir = process.env.TRAJECTORIES_DATA_DIR || ".trajectories";
  const compactedDir = join(trajDir, "compacted");

  if (!existsSync(compactedDir)) {
    mkdirSync(compactedDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  return join(compactedDir, `${compacted.id}_${dateStr}.json`);
}

function saveCompactedTrajectory(
  compacted: CompactedTrajectory,
  outputPath: string,
): void {
  const dir = join(outputPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(compacted, null, 2));
}

function printCompactedSummary(compacted: CompactedTrajectory): void {
  console.log("=== Compacted Trajectory Summary ===\n");
  console.log(`ID: ${compacted.id}`);
  console.log(`Source trajectories: ${compacted.sourceTrajectories.length}`);
  console.log(
    `Date range: ${formatDate(compacted.dateRange.start)} - ${formatDate(compacted.dateRange.end)}`,
  );
  console.log(`Total decisions: ${compacted.summary.totalDecisions}`);
  console.log(`Total events: ${compacted.summary.totalEvents}`);
  console.log(`Agents: ${compacted.summary.uniqueAgents.join(", ")}`);
  console.log("");

  console.log("=== Decision Groups ===\n");
  for (const group of compacted.decisionGroups) {
    console.log(`${capitalize(group.category)} (${group.decisions.length} decisions):`);
    for (const decision of group.decisions.slice(0, 3)) {
      console.log(`  - ${decision.question}`);
      console.log(`    Chose: ${decision.chosen}`);
    }
    if (group.decisions.length > 3) {
      console.log(`  ... and ${group.decisions.length - 3} more`);
    }
    console.log("");
  }

  if (compacted.keyLearnings.length > 0) {
    console.log("=== Key Learnings ===\n");
    for (const learning of compacted.keyLearnings.slice(0, 5)) {
      console.log(`  - ${learning}`);
    }
    if (compacted.keyLearnings.length > 5) {
      console.log(`  ... and ${compacted.keyLearnings.length - 5} more`);
    }
    console.log("");
  }

  if (compacted.filesAffected.length > 0) {
    console.log(`Files affected: ${compacted.filesAffected.length}`);
  }
  if (compacted.commits.length > 0) {
    console.log(`Commits: ${compacted.commits.length}`);
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
