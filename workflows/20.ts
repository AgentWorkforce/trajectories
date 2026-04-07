import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("20-cli-detector")
  .description(
    "Create trail-viewer/Sources/Services/CLIDetector.swift — PATH scanning and version detection for AI CLIs",
  )
  .pattern("pipeline")
  .channel("wf-20-cli-detector")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift services architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a CLIDetector.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation

2. Define enum CLIDetector (no cases — pure namespace):

   Static properties:
   - knownCLIs: [String] = ["claude", "codex", "opencode", "gemini", "aider", "droid"]
   - defaultPathEntries: [String] = ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "~/.local/bin", "~/.cargo/bin", "~/.npm-global/bin"]

   Static methods:

   detectAll() async -> [CLIInfo]:
   - Iterate over knownCLIs
   - For each, call resolveOnPath(named:)
   - If found, call detectVersion(at:) to get version
   - Return array of CLIInfo for all found CLIs
   - Run detection concurrently using TaskGroup

   resolveOnPath(named name: String) -> String?:
   - First try Process with "/usr/bin/which" to find the CLI
   - If that fails, check each defaultPathEntries path manually
   - Expand ~ in paths using NSString.expandingTildeInPath
   - Check if file exists and is executable using FileManager
   - Return the absolute path if found, nil otherwise

   detectVersion(at path: String) -> String?:
   - Try running the executable with --version flag via Process
   - If that fails, try -v flag
   - If that fails, try version subcommand
   - Parse output to extract version string (look for semver-like pattern)
   - Return version string or nil
   - Set a 5 second timeout on the Process

   Private helper:
   runProcess(executablePath: String, arguments: [String], timeout: TimeInterval = 5.0) -> String?:
   - Create Process, set executableURL, arguments
   - Capture stdout via Pipe
   - Launch, wait with timeout
   - Return trimmed stdout output or nil on error

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "CLIDetector" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Services/CLIDetector.swift from this spec:

{{steps.plan.output}}

Extract the CLIDetector.swift code and write it to trail-viewer/Sources/Services/CLIDetector.swift.
Create the trail-viewer/Sources/Services directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/CLIDetector.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Services/CLIDetector.swift && git commit -m "feat: add CLIDetector.swift — PATH scanning and version detection for AI CLIs"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("20-cli-detector:", result.status);
