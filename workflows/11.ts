import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("11-empty-state")
  .description(
    "Create trail-viewer/Sources/Design/EmptyState.swift — centered empty state with icon, title, subtitle",
  )
  .pattern("pipeline")
  .channel("wf-11-empty-state")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI component architect",
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
    task: `Output the COMPLETE contents of an EmptyState.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — warm, inviting empty states.

Requirements:

1. Import SwiftUI

2. EmptyState: View
   - Properties: icon: String, title: String, subtitle: String
   - Body: centered VStack with generous spacing (Theme.spacingLG = 24):
     - SF Symbol Image(systemName: icon) at 48pt font size, Theme.blue at 0.4 opacity
     - Title Text in .sectionTitle() style (18pt semibold serif, Theme.textPrimary)
     - Subtitle Text in .bodyStyle() (13.5pt, Theme.textSecondary), multilineTextAlignment(.center), max width 320
   - Frame: maxWidth .infinity, maxHeight .infinity (fills available space)
   - Padding: Theme.spacingXL (36) on all sides

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/11-empty-state.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/11-empty-state.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/11-empty-state.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Design/EmptyState.swift from this spec:

{{steps.read-spec.output}}

Extract the EmptyState.swift code and write it to trail-viewer/Sources/Design/EmptyState.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/EmptyState.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/EmptyState.swift && git commit -m "feat: add EmptyState.swift — centered empty state component"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("11-empty-state:", result.status);
