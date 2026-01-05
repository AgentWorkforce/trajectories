/**
 * trail list command
 */

import { existsSync } from "node:fs";
import type { Command } from "commander";
import type { TrajectoryStatus, TrajectorySummary } from "../../core/types.js";
import { FileStorage, getSearchPaths } from "../../storage/file.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List and search trajectories")
    .option(
      "-s, --status <status>",
      "Filter by status (active, completed, abandoned)",
    )
    .option("-l, --limit <number>", "Limit results", Number.parseInt)
    .option("--search <query>", "Search trajectories by title or content")
    .action(async (options) => {
      // Get all search paths and aggregate results
      const searchPaths = getSearchPaths();
      let allTrajectories: TrajectorySummary[] = [];
      const seenIds = new Set<string>();

      for (const searchPath of searchPaths) {
        // Skip paths that don't exist
        if (!existsSync(searchPath)) {
          continue;
        }

        // Create storage pointing to this path directly
        // We set TRAJECTORIES_DATA_DIR temporarily to use this path
        const originalDataDir = process.env.TRAJECTORIES_DATA_DIR;
        process.env.TRAJECTORIES_DATA_DIR = searchPath;

        try {
          const storage = new FileStorage();
          await storage.initialize();

          const trajectories = await storage.list({
            status: options.status as TrajectoryStatus | undefined,
            limit: options.search ? undefined : undefined, // Don't limit per-path
          });

          // Add to results, avoiding duplicates
          for (const traj of trajectories) {
            if (!seenIds.has(traj.id)) {
              seenIds.add(traj.id);
              allTrajectories.push(traj);
            }
          }
        } finally {
          // Restore original env var
          if (originalDataDir !== undefined) {
            process.env.TRAJECTORIES_DATA_DIR = originalDataDir;
          } else {
            process.env.TRAJECTORIES_DATA_DIR = undefined;
          }
        }
      }

      // Sort by startedAt descending (most recent first)
      allTrajectories.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

      // Apply search filter if provided
      if (options.search) {
        const query = options.search.toLowerCase();
        allTrajectories = allTrajectories.filter((traj) => {
          // Search in title
          if (traj.title.toLowerCase().includes(query)) return true;
          // Search in ID
          if (traj.id.toLowerCase().includes(query)) return true;
          return false;
        });
      }

      // Apply limit after aggregation and search
      if (options.limit) {
        allTrajectories = allTrajectories.slice(0, options.limit);
      }

      if (allTrajectories.length === 0) {
        if (options.search) {
          console.log(`No trajectories found matching "${options.search}"`);
        } else {
          console.log("No trajectories found");
        }
        return;
      }

      const searchNote = options.search ? ` matching "${options.search}"` : "";
      console.log(
        `Found ${allTrajectories.length} trajectories${searchNote}:\n`,
      );

      for (const traj of allTrajectories) {
        const statusIcon = getStatusIcon(traj.status);
        const confidence = traj.confidence
          ? ` (${Math.round(traj.confidence * 100)}%)`
          : "";

        console.log(`${statusIcon} ${traj.id}`);
        console.log(`   ${traj.title}${confidence}`);
        console.log(`   Started: ${formatDate(traj.startedAt)}`);
        if (traj.completedAt) {
          console.log(`   Completed: ${formatDate(traj.completedAt)}`);
        }
        console.log("");
      }
    });
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "active":
      return "🔄";
    case "completed":
      return "✅";
    case "abandoned":
      return "❌";
    default:
      return "•";
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
