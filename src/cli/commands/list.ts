/**
 * traj list command
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";
import type { TrajectoryStatus } from "../../core/types.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List trajectories")
    .option("-s, --status <status>", "Filter by status (active, completed, abandoned)")
    .option("-l, --limit <number>", "Limit results", parseInt)
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const trajectories = await storage.list({
        status: options.status as TrajectoryStatus | undefined,
        limit: options.limit,
      });

      if (trajectories.length === 0) {
        console.log("No trajectories found");
        return;
      }

      console.log(`Found ${trajectories.length} trajectories:\n`);

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
