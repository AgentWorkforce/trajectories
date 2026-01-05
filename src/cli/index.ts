/**
 * Trail CLI
 *
 * Leave a trail of your agent work for others to follow.
 *
 * The name "trail" comes from "trajectory" - while the trajectory is the
 * complete path an agent takes through a task, the trail is what's left
 * behind for future agents and humans to follow. You don't see the whole
 * trajectory in real-time, but you can always follow the trail.
 */

import { program } from "commander";
import { registerCommands } from "./commands/index.js";

program
  .name("trail")
  .description("Leave a trail of your work for others to follow")
  .version("0.1.0")
  .option(
    "--data-dir <path>",
    "Override trajectory storage directory (or set TRAJECTORIES_DATA_DIR)",
  )
  .hook("preAction", (thisCommand) => {
    // If --data-dir flag is set, override the env var before commands run
    const opts = thisCommand.opts();
    if (opts.dataDir) {
      process.env.TRAJECTORIES_DATA_DIR = opts.dataDir;
    }
  });

// Register all commands
registerCommands(program);

// Parse arguments
program.parse();
