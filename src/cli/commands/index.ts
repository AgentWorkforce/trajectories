/**
 * CLI Command Registration
 *
 * Registers all commands with the program.
 */

import type { Command } from "commander";
import { registerStartCommand } from "./start.js";
import { registerStatusCommand } from "./status.js";
import { registerCompleteCommand } from "./complete.js";
import { registerAbandonCommand } from "./abandon.js";
import { registerDecisionCommand } from "./decision.js";
import { registerChapterCommand } from "./chapter.js";
import { registerNoteCommand } from "./note.js";
import { registerListCommand } from "./list.js";
import { registerShowCommand } from "./show.js";
import { registerSearchCommand } from "./search.js";
import { registerExportCommand } from "./export.js";
import { registerViewCommand } from "./view.js";
import { registerWorkspaceCommand } from "./workspace.js";
import { registerContextCommand } from "./context.js";

/**
 * Register all CLI commands
 */
export function registerCommands(program: Command): void {
  registerStartCommand(program);
  registerStatusCommand(program);
  registerCompleteCommand(program);
  registerAbandonCommand(program);
  registerDecisionCommand(program);
  registerChapterCommand(program);
  registerNoteCommand(program);
  registerListCommand(program);
  registerShowCommand(program);
  registerSearchCommand(program);
  registerExportCommand(program);
  registerViewCommand(program);
  registerWorkspaceCommand(program);
  registerContextCommand(program);
}
