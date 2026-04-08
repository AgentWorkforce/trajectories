/**
 * Local CLI provider for compaction prompts.
 *
 * This avoids API keys by delegating prompt execution to an authenticated
 * local CLI such as Claude Code or Codex.
 */

import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { getCompactConfig } from "./config.js";

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Run the configured local CLI and return the model response.
 */
export async function compactWithCLI(
  prompt: string,
  options?: { cli?: string },
): Promise<string> {
  const config = getCompactConfig();
  const cli = options?.cli?.trim() || config.cli;

  if (!prompt.trim()) {
    throw new Error("Compaction prompt cannot be empty.");
  }

  const args = buildCliArgs(cli, prompt);
  const result = spawnSync(cli, args, {
    encoding: "utf-8",
    timeout: config.timeout,
    maxBuffer: DEFAULT_MAX_BUFFER,
  });

  if (result.error) {
    throw createCliError(cli, args, result.error);
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const exitReason = result.signal
      ? `terminated by signal ${result.signal}`
      : `exited with status ${result.status ?? "unknown"}`;
    const message = stderr || "No stderr output was captured.";

    throw new Error(
      `Compaction CLI command "${formatCommand(cli, args)}" ${exitReason}. ${message}`,
    );
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    throw new Error(
      `Compaction CLI command "${formatCommand(cli, args)}" returned no output.`,
    );
  }

  return stdout;
}

function buildCliArgs(cli: string, prompt: string): string[] {
  const normalizedName = basename(cli).toLowerCase();

  switch (normalizedName) {
    case "claude":
      return ["-p", prompt, "--output-format", "text"];
    case "codex":
      return ["exec", prompt];
    default:
      return ["-p", prompt];
  }
}

function createCliError(
  cli: string,
  args: string[],
  error: NodeJS.ErrnoException,
): Error {
  if (error.code === "ENOENT") {
    return new Error(
      `Compaction CLI "${cli}" is not installed or is not available on PATH.`,
    );
  }

  if (error.code === "ETIMEDOUT") {
    return new Error(
      `Compaction CLI command "${formatCommand(cli, args)}" timed out after ${getCompactConfig().timeout}ms.`,
    );
  }

  return new Error(
    `Failed to execute compaction CLI command "${formatCommand(cli, args)}": ${error.message}`,
  );
}

function formatCommand(cli: string, args: string[]): string {
  return [cli, ...args.map(quoteArg)].join(" ");
}

function quoteArg(value: string): string {
  if (!value.includes(" ")) {
    return value;
  }

  return JSON.stringify(value);
}
