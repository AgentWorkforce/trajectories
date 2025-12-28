/**
 * trail list command
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";
import type { TrajectoryStatus } from "../../core/types.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List and search trajectories")
    .option("-s, --status <status>", "Filter by status (active, completed, abandoned)")
    .option("-l, --limit <number>", "Limit results", parseInt)
    .option("--search <query>", "Search trajectories by title or content")
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      let trajectories = await storage.list({
        status: options.status as TrajectoryStatus | undefined,
        limit: options.search ? undefined : options.limit, // Apply limit after search
      });

      // Apply search filter if provided
      if (options.search) {
        const query = options.search.toLowerCase();
        trajectories = trajectories.filter((traj) => {
          // Search in title
          if (traj.title.toLowerCase().includes(query)) return true;
          // Search in ID
          if (traj.id.toLowerCase().includes(query)) return true;
          return false;
        });

        // Apply limit after search
        if (options.limit) {
          trajectories = trajectories.slice(0, options.limit);
        }
      }

      if (trajectories.length === 0) {
        if (options.search) {
          console.log(`No trajectories found matching "${options.search}"`);
        } else {
          console.log("No trajectories found");
        }
        return;
      }

      const searchNote = options.search ? ` matching "${options.search}"` : "";
      console.log(`Found ${trajectories.length} trajectories${searchNote}:\n`);

      for (const traj of trajectories) {
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
