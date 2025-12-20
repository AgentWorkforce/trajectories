/**
 * traj complete command
 */

import type { Command } from "commander";
import { completeTrajectory } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerCompleteCommand(program: Command): void {
  program
    .command("complete")
    .description("Complete the active trajectory with retrospective")
    .option("--summary <text>", "Summary of what was accomplished")
    .option("--approach <text>", "How the work was approached")
    .option("--confidence <number>", "Confidence level 0-1", parseFloat)
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error("Start one with: traj start \"Task description\"");
        throw new Error("No active trajectory");
      }

      // Require summary and confidence
      if (!options.summary) {
        console.error("Error: --summary is required");
        throw new Error("Summary required");
      }

      const confidence = options.confidence ?? 0.8;
      if (confidence < 0 || confidence > 1) {
        console.error("Error: --confidence must be between 0 and 1");
        throw new Error("Invalid confidence");
      }

      const completed = completeTrajectory(active, {
        summary: options.summary,
        approach: options.approach || "Standard approach",
        confidence,
      });

      await storage.save(completed);

      console.log(`✓ Trajectory completed: ${completed.id}`);
      console.log(`  Summary: ${options.summary}`);
      console.log(`  Confidence: ${Math.round(confidence * 100)}%`);
    });
}
