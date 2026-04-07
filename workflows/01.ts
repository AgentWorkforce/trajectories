import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("01-package-swift")
  .description(
    "Create trail-viewer/Package.swift — SPM config for macOS 14+ executable",
  )
  .pattern("pipeline")
  .channel("wf-01-package-swift")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift package architect",
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
    task: `Output the COMPLETE contents of a Swift Package Manager Package.swift file for a macOS app called "TrailViewer".

Requirements:
- swift-tools-version: 5.9
- macOS deployment target: .macOS(.v14)
- Package name: "TrailViewer"
- Single executable target named "TrailViewer" with sources in "Sources"
- No external dependencies (pure SwiftUI + Foundation)
- Include a comment header explaining this is the Trail Viewer Mac app

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "swift-tools-version" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create the file trail-viewer/Package.swift from this spec:

{{steps.plan.output}}

Extract the Package.swift code and write it to trail-viewer/Package.swift.
Create the trail-viewer directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: { type: "file_exists", value: "trail-viewer/Package.swift" },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Package.swift && git commit -m "chore: add Package.swift — SPM config for TrailViewer macOS app"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("01-package-swift:", result.status);
