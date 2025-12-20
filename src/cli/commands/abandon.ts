/**
 * traj abandon command
 */

import type { Command } from "commander";
import { abandonTrajectory } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";

export function registerAbandonCommand(program: Command): void {
  program
    .command("abandon")
    .description("Abandon the active trajectory")
    .option("-r, --reason <text>", "Reason for abandonment")
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        throw new Error("No active trajectory");
      }

      const abandoned = abandonTrajectory(active, options.reason);
      await storage.save(abandoned);

      console.log(`✓ Trajectory abandoned: ${abandoned.id}`);
      if (options.reason) {
        console.log(`  Reason: ${options.reason}`);
      }
    });
}
