/**
 * trail start command
 */

import type { Command } from "commander";
import { createTrajectory } from "../../core/trajectory.js";
import { FileStorage } from "../../storage/file.js";
import type { TaskSource } from "../../core/types.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start <title>")
    .description("Start a new trajectory")
    .option("-t, --task <id>", "External task ID")
    .option("-s, --source <system>", "Task system (github, linear, jira, beads)")
    .option("--url <url>", "URL to external task")
    .action(async (title: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      // Check if there's already an active trajectory
      const active = await storage.getActive();
      if (active) {
        console.error(`Error: Trajectory already active: ${active.id}`);
        console.error(`Complete or abandon it first with: trail complete or trail abandon`);
        throw new Error("Trajectory already active");
      }

      // Build task source if provided
      let source: TaskSource | undefined;
      if (options.task) {
        source = {
          system: options.source || "plain",
          id: options.task,
          url: options.url,
        };
      }

      // Create the trajectory
      const trajectory = createTrajectory({
        title,
        source,
      });

      await storage.save(trajectory);

      console.log(`✓ Trajectory started: ${trajectory.id}`);
      console.log(`  Title: ${title}`);
      if (source) {
        console.log(`  Linked to: ${source.id} (${source.system})`);
      }
    });
}
