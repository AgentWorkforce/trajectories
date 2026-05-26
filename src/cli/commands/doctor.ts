/**
 * trail doctor command
 *
 * Diagnose and (optionally) repair trajectory files that fail to load.
 * Reconcile silently skips bad files so the CLI keeps working; doctor
 * surfaces the path + first validation error for each one and can move
 * them into `.agentworkforce/trajectories/invalid/` so reconcile stops complaining.
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description(
      "List trajectory files that fail to load; optionally quarantine them",
    )
    .option(
      "--quarantine",
      "Move invalid files to .agentworkforce/trajectories/invalid/ so reconcile stops scanning them",
    )
    .action(async (opts: { quarantine?: boolean }) => {
      const storage = new FileStorage();
      await storage.initialize();

      const summary = storage.getLastReconcileSummary();
      const failures = summary?.failures ?? [];

      if (failures.length === 0) {
        console.log("No invalid trajectory files found.");
        return;
      }

      console.log(`Found ${failures.length} invalid trajectory file(s):`);
      for (const failure of failures) {
        console.log(`  ${failure.path}`);
        console.log(`    reason:  ${failure.reason}`);
        console.log(`    detail:  ${failure.message}`);
      }

      if (!opts.quarantine) {
        console.log(
          "\nRun `trail doctor --quarantine` to move these files into .agentworkforce/trajectories/invalid/.",
        );
        return;
      }

      const result = await storage.quarantineInvalid();
      if (result.moved.length === 0) {
        console.log(
          "\nNo files were moved (io_error failures are not auto-quarantined).",
        );
        return;
      }
      console.log(
        `\nMoved ${result.moved.length} file(s) to ${result.targetDir}:`,
      );
      for (const failure of result.moved) {
        console.log(`  ${failure.path}`);
      }
    });
}
