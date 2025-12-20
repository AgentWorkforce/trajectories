/**
 * traj status command
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show active trajectory status")
    .action(async () => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();

      if (!active) {
        console.log("No active trajectory");
        console.log("Start one with: traj start \"Task description\"");
        return;
      }

      const duration = formatDuration(
        new Date().getTime() - new Date(active.startedAt).getTime()
      );

      const eventCount = active.chapters.reduce(
        (sum, ch) => sum + ch.events.length,
        0
      );

      const decisionCount = active.chapters.reduce(
        (sum, ch) => sum + ch.events.filter((e) => e.type === "decision").length,
        0
      );

      console.log(`Active Trajectory: ${active.id}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Task:      ${active.task.title}`);
      if (active.task.source) {
        console.log(`Source:    ${active.task.source.system}:${active.task.source.id}`);
      }
      console.log(`Status:    ${active.status}`);
      console.log(`Started:   ${duration} ago`);
      console.log(`Chapters:  ${active.chapters.length}`);
      console.log(`Events:    ${eventCount}`);
      console.log(`Decisions: ${decisionCount}`);

      if (active.chapters.length > 0) {
        const currentChapter = active.chapters[active.chapters.length - 1];
        console.log(`\nCurrent Chapter: ${currentChapter.title}`);
        console.log(`  Agent: ${currentChapter.agentName}`);
      }
    });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
