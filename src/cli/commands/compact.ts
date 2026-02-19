/**
 * trail compact command
 *
 * Compresses multiple trajectories into a single compacted summary.
 * Useful for reducing context after PR merges by organizing similar
 * decisions into grouped, understandable summaries.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import type {
  Decision,
  Trajectory,
  TrajectoryEvent,
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

export function registerCompactCommand(program: Command): void {
  program
    .command("compact")
    .description("Compact trajectories into a summarized form")
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
    .option("--dry-run", "Preview what would be compacted without saving")
    .option("--output <path>", "Output path for compacted trajectory")
    .action(async (options) => {
      const trajectories = await loadTrajectories(options);

      if (trajectories.length === 0) {
        console.log("No trajectories found matching criteria");
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

      console.log(`\nCompacted trajectory saved to: ${outputPath}`);
      printCompactedSummary(compacted);
    });
}

async function loadTrajectories(options: {
  since?: string;
  until?: string;
  ids?: string;
  pr?: string;
}): Promise<Trajectory[]> {
  const trajectories: Trajectory[] = [];
  const targetIds = options.ids ? options.ids.split(",").map((s) => s.trim()) : null;

  // Parse date filters
  const sinceDate = options.since ? parseRelativeDate(options.since) : null;
  const untilDate = options.until ? new Date(options.until) : null;

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
