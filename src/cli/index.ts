#!/usr/bin/env node
/**
 * Agent Trajectories CLI
 *
 * Entry point for the `traj` command-line interface.
 */

import { program } from "commander";
import { registerCommands } from "./commands/index.js";

program
  .name("traj")
  .description("Capture the complete train of thought of agent work")
  .version("0.1.0");

// Register all commands
registerCommands(program);

// Parse arguments
program.parse();
