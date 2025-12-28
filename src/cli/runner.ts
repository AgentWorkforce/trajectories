/**
 * CLI Runner
 *
 * Executes CLI commands programmatically for testing and scripting.
 */

import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Run a CLI command programmatically
 * @param args - Command arguments (e.g., ["start", "My task"])
 * @returns Command result with output or error
 */
export async function runCommand(args: string[]): Promise<CommandResult> {
  const program = new Command();
  let output = "";
  let error = "";

  // Capture output
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => {
    output += args.join(" ") + "\n";
  };
  console.error = (...args) => {
    error += args.join(" ") + "\n";
  };

  try {
    program
      .name("traj")
      .description("Capture the complete train of thought of agent work")
      .version("0.1.0")
      .exitOverride() // Don't exit process on error
      .configureOutput({
        writeOut: (str) => { output += str; },
        writeErr: (str) => { error += str; },
      });

    registerCommands(program);

    await program.parseAsync(["node", "traj", ...args]);

    return {
      success: error.length === 0,
      output: output.trim(),
      error: error.trim() || undefined,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: output.trim(),
      error: error.trim() || errorMessage,
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
