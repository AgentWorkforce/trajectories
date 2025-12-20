/**
 * trail decision command
 */

import type { Command } from "commander";
import { addDecision } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerDecisionCommand(program: Command): void {
  program
    .command("decision <choice>")
    .description("Record a decision")
    .requiredOption("-r, --reasoning <text>", "Why this choice was made")
    .option("-a, --alternatives <items>", "Comma-separated alternatives considered")
    .action(async (choice: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error("Start one with: trail start \"Task description\"");
        throw new Error("No active trajectory");
      }

      const alternatives = options.alternatives
        ? options.alternatives.split(",").map((s: string) => s.trim())
        : [];

      const updated = addDecision(active, {
        question: choice,
        chosen: choice,
        alternatives,
        reasoning: options.reasoning,
      });

      await storage.save(updated);

      console.log(`✓ Decision recorded: ${choice}`);
      console.log(`  Reasoning: ${options.reasoning}`);
      if (alternatives.length > 0) {
        console.log(`  Alternatives: ${alternatives.join(", ")}`);
      }
    });
}
