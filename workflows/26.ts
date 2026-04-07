import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("26-sidebar-header")
  .description(
    "Create trail-viewer/Sources/Views/Sidebar/SidebarHeader.swift — serif title, rule line, stats summary",
  )
  .pattern("pipeline")
  .channel("wf-26-sidebar-header")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI sidebar designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: SidebarHeader.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct SidebarHeader: View
- Accept an optional trajectoryCount: Int and activeCount: Int via init or @EnvironmentObject from TrajectoryStore
- Layout (VStack, left-aligned):
  1. "Trail Viewer" title using Typography.chapterTitle style (serif .design(.serif), ~22pt, Theme.textPrimary color)
  2. Below the title: a thin RuleLine (1pt horizontal divider in Theme.borderLight color, full width)
  3. Below the rule: a stats summary line in Typography.caption style (~12pt, Theme.textTertiary)
     - Format: "{count} trajectories · {activeCount} active" when data is loaded
     - Show nothing or a subtle placeholder when no data
- Background: Theme.sidebarBg (#f0ece4)
- Generous padding: spacingLG (~20pt) horizontal, spacingMD (~12pt) vertical
- Assume Theme, Typography, and RuleLine are defined in the Design/ folder and available
- Add a PreviewProvider with mock data

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/26-sidebar-header.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/26-sidebar-header.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/26-sidebar-header.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Sidebar/SidebarHeader.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Sidebar/SidebarHeader.swift.
Create the directory trail-viewer/Sources/Views/Sidebar/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Sidebar/SidebarHeader.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Sidebar/SidebarHeader.swift && git commit -m "feat: add SidebarHeader — serif title, rule line, and stats summary"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("26-sidebar-header:", result.status);
