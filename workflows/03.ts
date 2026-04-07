import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("03-app-config")
  .description(
    "Create trail-viewer/Sources/AppConfiguration.swift — server URLs and default paths",
  )
  .pattern("pipeline")
  .channel("wf-03-app-config")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift configuration architect",
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
    task: `Output the COMPLETE contents of an AppConfiguration.swift file for the Trail Viewer macOS app.

Requirements:
- Import Foundation
- Define an enum AppConfiguration (no cases — pure namespace)
- Static properties:
  - serverBaseURL: URL = URL(string: "http://localhost:3847")!
  - wsBaseURL: URL = URL(string: "ws://localhost:3847")!
  - defaultTrajectoryPaths: [String] — array with common default paths like "~/.trajectories", "./trajectories", "./trail-data"
  - serverStartupTimeout: TimeInterval = 15.0
  - maxRecentPaths: Int = 10
  - appName: String = "Trail Viewer"
  - appVersion: String = "1.0.0"
- Add a comment header explaining this is the app configuration

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/03-app-config.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/03-app-config.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/03-app-config.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/AppConfiguration.swift from this spec:

{{steps.read-spec.output}}

Extract the AppConfiguration.swift code and write it to trail-viewer/Sources/AppConfiguration.swift.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/AppConfiguration.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/AppConfiguration.swift && git commit -m "feat: add AppConfiguration — server URLs and default paths"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("03-app-config:", result.status);
