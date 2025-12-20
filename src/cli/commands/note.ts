/**
 * traj note command
 */

import type { Command } from "commander";
import { addEvent } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerNoteCommand(program: Command): void {
  program
    .command("note <text>")
    .description("Add a note to the trajectory")
    .action(async (text: string) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        throw new Error("No active trajectory");
      }

      const updated = addEvent(active, {
        type: "note",
        content: text,
      });

      await storage.save(updated);

      console.log(`✓ Note added: ${text}`);
    });
}
