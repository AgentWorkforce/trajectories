/**
 * trail enable / trail disable commands
 *
 * Installs or removes a prepare-commit-msg git hook that automatically
 * appends Trajectory trailers to commit messages.
 */

import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { Command } from "commander";
import {
  detectExistingHook,
  generateHookScript,
} from "../../core/trailers.js";
import { isGitRepo } from "../../core/trace.js";

/**
 * Resolve the git hooks directory path
 */
function getHooksDir(): string | null {
  try {
    const gitDir = execSync("git rev-parse --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return join(gitDir, "hooks");
  } catch {
    return null;
  }
}

export function registerEnableCommand(program: Command): void {
  program
    .command("enable")
    .description(
      "Install git hook to automatically link commits to trajectories",
    )
    .option("--force", "Overwrite existing prepare-commit-msg hook")
    .action(async (options) => {
      if (!isGitRepo()) {
        console.error("Error: Not inside a git repository");
        throw new Error("Not a git repository");
      }

      const hooksDir = getHooksDir();
      if (!hooksDir) {
        console.error("Error: Could not determine git hooks directory");
        throw new Error("Cannot find hooks directory");
      }

      const hookPath = join(hooksDir, "prepare-commit-msg");
      const existing = detectExistingHook();

      if (existing === "other" && !options.force) {
        console.error(
          "Error: A prepare-commit-msg hook already exists",
        );
        console.error(
          "Use --force to overwrite, or manually add the trailer logic",
        );
        throw new Error("Hook already exists");
      }

      if (existing === "ours") {
        console.log("Trajectory hook is already installed");
        return;
      }

      // Ensure hooks directory exists
      if (!existsSync(hooksDir)) {
        await mkdir(hooksDir, { recursive: true });
      }

      // Write the hook script
      const hookContent = generateHookScript();
      await writeFile(hookPath, hookContent, "utf-8");
      await chmod(hookPath, 0o755);

      console.log("Trajectory hook installed");
      console.log(`  Hook: ${hookPath}`);
      console.log(
        "  Commits will now include a Trajectory trailer when a trajectory is active",
      );
    });

  program
    .command("disable")
    .description("Remove the trajectory git hook")
    .action(async () => {
      if (!isGitRepo()) {
        console.error("Error: Not inside a git repository");
        throw new Error("Not a git repository");
      }

      const hooksDir = getHooksDir();
      if (!hooksDir) {
        console.error("Error: Could not determine git hooks directory");
        throw new Error("Cannot find hooks directory");
      }

      const hookPath = join(hooksDir, "prepare-commit-msg");
      const existing = detectExistingHook();

      if (existing === "none") {
        console.log("No trajectory hook installed");
        return;
      }

      if (existing === "other") {
        console.error(
          "Error: The prepare-commit-msg hook was not installed by agent-trajectories",
        );
        console.error("Remove it manually if needed");
        throw new Error("Hook not ours");
      }

      // Read the hook to confirm it's ours, then remove it
      const { unlink } = await import("node:fs/promises");
      await unlink(hookPath);

      console.log("Trajectory hook removed");
    });
}
