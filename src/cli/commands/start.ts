/**
 * trail start command
 */

import type { Command } from "commander";
import { captureGitState, createTraceRef } from "../../core/trace.js";
import { addChapter, createTrajectory } from "../../core/trajectory.js";
import type { TaskSource } from "../../core/types.js";
import { FileStorage } from "../../storage/file.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start <title>")
    .description("Start a new trajectory")
    .option("-t, --task <id>", "External task ID")
    .option(
      "-s, --source <system>",
      "Task system (github, linear, jira, beads)",
    )
    .option("--url <url>", "URL to external task")
    .option("-a, --agent <name>", "Agent name (or set TRAJECTORIES_AGENT)")
    .option("-p, --project <id>", "Project ID (or set TRAJECTORIES_PROJECT)")
    .option("-q, --quiet", "Only output trajectory ID (for scripting)")
    .action(async (title: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      // Check if there's already an active trajectory
      const active = await storage.getActive();
      if (active) {
        if (!options.quiet) {
          console.error(`Error: Trajectory already active: ${active.id}`);
          console.error(
            "Complete or abandon it first with: trail complete or trail abandon",
          );
        }
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

      // Resolve agent name from CLI flag or env var
      const agentName =
        options.agent ?? process.env.TRAJECTORIES_AGENT ?? undefined;

      // Resolve project ID from CLI flag or env var
      const projectId =
        options.project ?? process.env.TRAJECTORIES_PROJECT ?? undefined;

      // Capture git state for trace tracking
      const startRef = captureGitState();

      // Create the trajectory
      let trajectory = createTrajectory({
        title,
        source,
        projectId,
      });

      // Add trace reference if in a git repo
      if (startRef) {
        trajectory = {
          ...trajectory,
          _trace: createTraceRef(startRef),
        };
      }

      // If agent specified, add initial chapter with agent name
      if (agentName) {
        trajectory = addChapter(trajectory, {
          title: "Initial work",
          agentName,
        });
      }

      await storage.save(trajectory);

      if (options.quiet) {
        // Only output trajectory ID for scripting
        console.log(trajectory.id);
      } else {
        console.log(`✓ Trajectory started: ${trajectory.id}`);
        console.log(`  Title: ${title}`);
        if (agentName) {
          console.log(`  Agent: ${agentName}`);
        }
        if (projectId) {
          console.log(`  Project: ${projectId}`);
        }
        if (source) {
          console.log(`  Linked to: ${source.id} (${source.system})`);
        }
      }
    });
}
