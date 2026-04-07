/**
 * CLI Resolver — resolves CLI preferences to spawn configurations
 * for the Trail Viewer server.
 */

export interface CLIPreference {
  cli: string;
  fallback?: string;
}

export interface SpawnConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export const DEFAULT_CLI = "claude";

export const CLI_SPAWN_CONFIGS: Record<string, SpawnConfig> = {
  claude: { command: "claude", args: ["--print", "--verbose"], env: {} },
  codex: { command: "codex", args: [], env: {} },
  aider: { command: "aider", args: ["--yes-always"], env: {} },
  copilot: { command: "gh", args: ["copilot"], env: {} },
};

export function resolveSpawnConfig(preferredCLI?: string): SpawnConfig {
  const cli = preferredCLI ?? DEFAULT_CLI;

  if (cli in CLI_SPAWN_CONFIGS) {
    return CLI_SPAWN_CONFIGS[cli];
  }

  return { command: cli, args: [], env: {} };
}

export function isValidCLI(cli: string): boolean {
  return cli in CLI_SPAWN_CONFIGS;
}

export function getAvailableCLIs(): string[] {
  return Object.keys(CLI_SPAWN_CONFIGS);
}
