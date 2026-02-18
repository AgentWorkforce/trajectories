/**
 * trail reflect command
 *
 * Records a reflection event — a higher-level synthesis of recent observations.
 * Used by workflow orchestrators and lead agents to periodically
 * synthesize progress and course-correct.
 */

import type { Command } from "commander";
import { addEvent } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerReflectCommand(program: Command): void {
  program
    .command("reflect <synthesis>")
    .description("Record a reflection (periodic synthesis of progress)")
    .option(
      "-f, --focal-points <items>",
      "Comma-separated focal points that prompted this reflection",
    )
    .option(
      "-c, --confidence <number>",
      "Confidence in current trajectory (0-1)",
      Number.parseFloat,
    )
    .option(
      "-a, --adjustments <text>",
      "Course corrections triggered by this reflection",
    )
    .action(async (synthesis: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error('Start one with: trail start "Task description"');
        throw new Error("No active trajectory");
      }

      const tags: string[] = [];
      if (options.focalPoints) {
        for (const fp of options.focalPoints.split(",")) {
          tags.push(`focal:${fp.trim()}`);
        }
      }
      if (options.confidence !== undefined) {
        tags.push(`confidence:${options.confidence}`);
      }

      const raw: Record<string, unknown> = {};
      if (options.focalPoints) {
        raw.focalPoints = options.focalPoints
          .split(",")
          .map((s: string) => s.trim());
      }
      if (options.adjustments) {
        raw.adjustments = options.adjustments;
      }
      if (options.confidence !== undefined) {
        raw.confidence = options.confidence;
      }

      const updated = addEvent(active, {
        type: "reflection",
        content: synthesis,
        significance: "high",
        tags: tags.length > 0 ? tags : undefined,
        raw: Object.keys(raw).length > 0 ? raw : undefined,
      });

      await storage.save(updated);

      console.log(`✓ Reflection recorded: ${synthesis}`);
      if (options.focalPoints) {
        console.log(`  Focal points: ${options.focalPoints}`);
      }
      if (options.confidence !== undefined) {
        console.log(`  Confidence: ${options.confidence}`);
      }
      if (options.adjustments) {
        console.log(`  Adjustments: ${options.adjustments}`);
      }
    });
}
