import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("27-filter-bar")
  .description(
    "Create trail-viewer/Sources/Views/Sidebar/FilterBar.swift — search field and status filter pills",
  )
  .pattern("pipeline")
  .channel("wf-27-filter-bar")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI filter component designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: FilterBar.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct FilterBar: View
- Accept bindings: @Binding var searchText: String, @Binding var statusFilter: StatusFilter
- Define enum StatusFilter: String, CaseIterable { case all, active, completed, abandoned }
- Layout (VStack, spacing: spacingSmall ~8pt):
  1. Search field:
     - Rounded rectangle background (Theme.cardBg, cornerRadius 8)
     - HStack: magnifyingglass SF Symbol (Theme.textTertiary) + TextField("Search trajectories...", text: $searchText)
     - Padding inside the field: spacingSM (~8pt)
  2. Status pills row:
     - HStack with spacing spacingSM
     - For each StatusFilter.allCases, a pill button:
       - Selected state: filled with the status color (all=Theme.blue, active=Theme.green, completed=Theme.blue, abandoned=Theme.textTertiary), white text
       - Unselected state: Theme.cardBg background, Theme.textSecondary text
       - Pill shape: Capsule(), padding horizontal spacingSM, vertical 4pt
       - Typography.caption font
       - Tap action: set statusFilter to that case
       - Animation on change
- Horizontal padding: spacingLG (~20pt)
- Assume Theme, Typography are defined in Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/27-filter-bar.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/27-filter-bar.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/27-filter-bar.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Sidebar/FilterBar.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Sidebar/FilterBar.swift.
Create the directory trail-viewer/Sources/Views/Sidebar/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Sidebar/FilterBar.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Sidebar/FilterBar.swift && git commit -m "feat: add FilterBar — search field and status filter pills"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("27-filter-bar:", result.status);
