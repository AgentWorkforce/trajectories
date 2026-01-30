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
    .option(
      "-r, --reasoning <text>",
      "Why this choice was made (optional for minor decisions)",
    )
    .option(
      "-a, --alternatives <items>",
      "Comma-separated alternatives considered",
    )
    .action(async (choice: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error('Start one with: trail start "Task description"');
        throw new Error("No active trajectory");
      }

      const alternatives = options.alternatives
        ? options.alternatives
            .split(",")
            .map((s: string) => ({ option: s.trim(), reason: "" }))
        : [];

      const reasoning = options.reasoning || "";

      const updated = addDecision(active, {
        question: choice,
        chosen: choice,
        alternatives,
        reasoning,
      });

      await storage.save(updated);

      console.log(`✓ Decision recorded: ${choice}`);
      if (reasoning) {
        console.log(`  Reasoning: ${reasoning}`);
      }
      if (alternatives.length > 0) {
        const altStrings = alternatives.map(
          (a: { option: string }) => a.option,
        );
        console.log(`  Alternatives: ${altStrings.join(", ")}`);
      }
    });
}
