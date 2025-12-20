/**
 * trail chapter command
 */

import type { Command } from "commander";
import { addChapter } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerChapterCommand(program: Command): void {
  program
    .command("chapter <title>")
    .description("Start a new chapter")
    .option("-a, --agent <name>", "Agent name", "default")
    .action(async (title: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        throw new Error("No active trajectory");
      }

      const updated = addChapter(active, {
        title,
        agentName: options.agent,
      });

      await storage.save(updated);

      console.log(`✓ Chapter started: ${title}`);
      console.log(`  Agent: ${options.agent}`);
    });
}
