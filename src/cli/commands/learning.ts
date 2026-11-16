/**
 * trail learning command
 *
 * Records codebase-specific learnings without modifying durable project
 * instructions. Promotion candidates remain pending until a separate human
 * review.
 */

import type { Command } from "commander";
import { addLearning } from "../../core/trajectory.js";
import type { LearningSource } from "../../core/types.js";
import { FileStorage } from "../../storage/file.js";

export function registerLearningCommand(program: Command): void {
  program
    .command("learning <summary>")
    .description("Record a project learning")
    .requiredOption(
      "-s, --source <source>",
      "Origin: human-steer, pr-feedback, failed-attempt, code-review, or other",
    )
    .requiredOption("-a, --area <area>", "Affected project area")
    .option("-e, --evidence <text>", "Supporting evidence or reference")
    .option(
      "-k, --recurrence-key <key>",
      "Stable key for grouping repeated learnings",
    )
    .option(
      "--promotion-candidate",
      "Mark as pending human review (does not update project instructions)",
    )
    .action(async (summary: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error('Start one with: trail start "Task description"');
        throw new Error("No active trajectory");
      }

      const promotionStatus = options.promotionCandidate
        ? "pending_review"
        : "archived";
      const updated = addLearning(active, {
        summary,
        source: options.source as LearningSource,
        area: options.area,
        evidence: options.evidence,
        recurrenceKey: options.recurrenceKey,
        promotionStatus,
      });

      await storage.save(updated);

      console.log(`✓ Learning recorded: ${summary}`);
      console.log(`  Source: ${options.source}`);
      console.log(`  Area: ${options.area}`);
      console.log(`  Promotion: ${promotionStatus}`);
      if (promotionStatus === "pending_review") {
        console.log(
          "  Human review required; no durable instructions were changed",
        );
      }
    });
}
