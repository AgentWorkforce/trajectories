import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("07-layout-constants")
  .description(
    "Create trail-viewer/Sources/Design/LayoutConstants.swift — sidebar, panel, and content layout dimensions",
  )
  .pattern("pipeline")
  .channel("wf-07-layout-constants")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI layout architect",
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
    task: `Output the COMPLETE contents of a LayoutConstants.swift file for the Trail Viewer macOS app.

This file extends the Theme design system with layout-specific dimensions.

Requirements:

1. Import SwiftUI

2. Define enum LayoutConstants (no cases — pure namespace) with static CGFloat properties:

   Sidebar:
   - sidebarWidth: CGFloat = 250
   - sidebarMinWidth: CGFloat = 200
   - sidebarMaxWidth: CGFloat = 350

   Chat Panel:
   - chatPanelWidth: CGFloat = 340
   - chatPanelMinWidth: CGFloat = 280
   - chatPanelMaxWidth: CGFloat = 500

   Content:
   - contentMaxWidth: CGFloat = 720
   - contentPadding: CGFloat = 32 (generous horizontal margins)

   Header:
   - headerHeight: CGFloat = 52
   - statusBarHeight: CGFloat = 28

   Timeline:
   - timelineRailWidth: CGFloat = 48
   - timelineDotSize: CGFloat = 8
   - timelineLineWidth: CGFloat = 1.5

   Cards:
   - cardPadding: CGFloat = 16
   - cardSpacing: CGFloat = 12

   Minimum window:
   - minWindowWidth: CGFloat = 900
   - minWindowHeight: CGFloat = 600
   - defaultWindowWidth: CGFloat = 1200
   - defaultWindowHeight: CGFloat = 800

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/07-layout-constants.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/07-layout-constants.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/07-layout-constants.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Design/LayoutConstants.swift from this spec:

{{steps.read-spec.output}}

Extract the LayoutConstants.swift code and write it to trail-viewer/Sources/Design/LayoutConstants.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/LayoutConstants.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/LayoutConstants.swift && git commit -m "feat: add LayoutConstants.swift — sidebar, panel, and content dimensions"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("07-layout-constants:", result.status);
