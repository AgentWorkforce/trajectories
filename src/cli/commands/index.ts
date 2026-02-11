/**
 * CLI Command Registration
 *
 * Registers all commands with the program.
 *
 * Core commands (10 total):
 * - start: Begin tracking a new task
 * - status: Show current trajectory state
 * - decision: Record a decision point
 * - complete: Finish with retrospective
 * - abandon: Stop without completing
 * - list: Browse trajectories (with --search)
 * - show: View trajectory details
 * - export: Output in various formats (with --open)
 * - enable: Install git hook for trajectory trailers
 * - disable: Remove the trajectory git hook
 */

import type { Command } from "commander";
import { registerAbandonCommand } from "./abandon.js";
import { registerCompleteCommand } from "./complete.js";
import { registerDecisionCommand } from "./decision.js";
import { registerEnableCommand } from "./enable.js";
import { registerExportCommand } from "./export.js";
import { registerListCommand } from "./list.js";
import { registerShowCommand } from "./show.js";
import { registerStartCommand } from "./start.js";
import { registerStatusCommand } from "./status.js";

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  registerStartCommand(program);
  registerStatusCommand(program);
  registerCompleteCommand(program);
  registerAbandonCommand(program);
  registerDecisionCommand(program);
  registerListCommand(program);
  registerShowCommand(program);
  registerExportCommand(program);
  registerEnableCommand(program);
}
