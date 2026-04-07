import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("21-local-server-manager")
  .description(
    "Create trail-viewer/Sources/Services/LocalServerManager.swift — spawn and manage TypeScript server subprocess",
  )
  .pattern("pipeline")
  .channel("wf-21-local-server-manager")
  .maxConcurrency(2)
  .timeout(1_200_000)

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
    task: `Output the COMPLETE contents of a LocalServerManager.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable macro)

3. ServerState enum (String):
   - stopped, starting, running, error

4. @Observable class LocalServerManager:

   Properties:
   - private(set) var state: ServerState = .stopped
   - private(set) var errorMessage: String?
   - private(set) var port: Int = 3847
   - private var serverProcess: Process?
   - private var outputPipe: Pipe?
   - private var errorPipe: Pipe?
   - private var startupTask: Task<Void, Never>?

   Computed:
   - isRunning: Bool { state == .running }
   - statusDescription: String — human-readable status

   Methods:

   start(trajectoryPath: String? = nil):
   - Guard state is .stopped or .error
   - Set state to .starting, clear errorMessage
   - Create a Process:
     - executableURL = find "npx" on PATH (use /usr/bin/env npx)
     - arguments = ["tsx", "src/server.ts"]
     - currentDirectoryURL = server directory (resolve relative to app bundle or working dir)
     - Set environment variables:
       - TRAJECTORIES_DATA_DIR = trajectoryPath (if provided)
       - PORT = String(port)
       - Merge with ProcessInfo.processInfo.environment
   - Set up stdout/stderr Pipes
   - Add handler on outputPipe.fileHandleForReading for readabilityHandler:
     - Read data, convert to string
     - Check for startup confirmation (look for "listening" or "started" in output)
     - When found, set state to .running on MainActor
   - Launch process
   - Set terminationHandler on process:
     - If not intentional stop, set state to .error with termination reason
   - Set timeout: if state is still .starting after AppConfiguration.serverStartupTimeout seconds, set state to .error

   stop():
   - startupTask?.cancel()
   - Guard serverProcess is not nil
   - serverProcess?.terminate()
   - serverProcess?.waitUntilExit()
   - serverProcess = nil
   - Set state to .stopped

   restart(trajectoryPath: String? = nil):
   - stop()
   - Brief delay (0.5s)
   - start(trajectoryPath: trajectoryPath)

   deinit:
   - Call stop() if process is running

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/21-local-server-manager.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/21-local-server-manager.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/21-local-server-manager.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Services/LocalServerManager.swift from this spec:

{{steps.read-spec.output}}

Extract the LocalServerManager.swift code and write it to trail-viewer/Sources/Services/LocalServerManager.swift.
Create the trail-viewer/Sources/Services directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/LocalServerManager.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Services/LocalServerManager.swift && git commit -m "feat: add LocalServerManager.swift — spawn and manage TypeScript server subprocess"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("21-local-server-manager:", result.status);
