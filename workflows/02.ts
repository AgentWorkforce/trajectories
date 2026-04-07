import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("02-app-entry")
  .description(
    "Create trail-viewer/Sources/TrailViewerApp.swift — @main entry point with WindowGroup",
  )
  .pattern("pipeline")
  .channel("wf-02-app-entry")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI app architect",
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
    task: `Output the COMPLETE contents of a SwiftUI app entry point file: TrailViewerApp.swift.

Requirements:
- Import SwiftUI
- Use @main attribute on the App struct
- Struct name: TrailViewerApp conforming to App
- body returns a WindowGroup with a placeholder Text("Trail Viewer") as content
- Set default window size to 1200x800 using .defaultSize(width: 1200, height: 800)
- Set minimum window size to 900x600 using .windowResizability(.contentMinSize) and frame(minWidth: 900, minHeight: 600) on the content
- Window title: "Trail Viewer"
- Add a comment header: "Trail Viewer — macOS app entry point"
- Light mode ONLY: force .preferredColorScheme(.light) on the WindowGroup content

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/02-app-entry.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/02-app-entry.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/02-app-entry.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/TrailViewerApp.swift from this spec:

{{steps.read-spec.output}}

Extract the TrailViewerApp.swift code and write it to trail-viewer/Sources/TrailViewerApp.swift.
Create the trail-viewer/Sources directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/TrailViewerApp.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/TrailViewerApp.swift && git commit -m "feat: add TrailViewerApp.swift — @main entry with WindowGroup"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("02-app-entry:", result.status);
