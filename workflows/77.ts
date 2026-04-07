import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("77-cli-resolver")
  .description(
    "Create trail-viewer/server/src/cli-resolver.ts — CLI preference handling and spawn config resolution",
  )
  .pattern("pipeline")
  .channel("wf-77-cli-resolver")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for CLI configuration",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "TypeScript implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a TypeScript file: cli-resolver.ts for the Trail Viewer server.

Requirements:
- Define and export interface CLIPreference:
  - cli: string (the preferred CLI tool name)
  - fallback?: string (optional fallback CLI)

- Define and export interface SpawnConfig:
  - command: string (the CLI command to run, e.g. "claude", "codex")
  - args: string[] (default arguments/flags for spawning)
  - env?: Record<string, string> (optional environment variables)

- Export const DEFAULT_CLI = "claude"

- Export const CLI_SPAWN_CONFIGS: Record<string, SpawnConfig>
  Map of known CLI tools to their spawn configurations:
  - "claude": { command: "claude", args: ["--print", "--verbose"], env: {} }
  - "codex": { command: "codex", args: [], env: {} }
  - "aider": { command: "aider", args: ["--yes-always"], env: {} }
  - "copilot": { command: "gh", args: ["copilot"], env: {} }

- Export function resolveSpawnConfig(preferredCLI?: string): SpawnConfig
  - If preferredCLI is provided and exists in CLI_SPAWN_CONFIGS, return that config
  - If preferredCLI is provided but not recognized, return a generic config:
    { command: preferredCLI, args: [], env: {} }
  - If no preferredCLI, use DEFAULT_CLI
  - Return the resolved SpawnConfig

- Export function isValidCLI(cli: string): boolean
  - Returns true if cli is a key in CLI_SPAWN_CONFIGS

- Export function getAvailableCLIs(): string[]
  - Returns Object.keys(CLI_SPAWN_CONFIGS)

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/77-cli-resolver.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/77-cli-resolver.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/77-cli-resolver.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/cli-resolver.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/cli-resolver.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/cli-resolver.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/cli-resolver.ts && git commit -m "feat: add CLI resolver — spawn config resolution for multiple CLI tools"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("77-cli-resolver:", result.status);
