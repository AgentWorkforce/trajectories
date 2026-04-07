import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("30-sidebar-skeleton")
  .description(
    "Create trail-viewer/Sources/Views/Sidebar/SidebarSkeleton.swift — shimmer loading placeholder for sidebar",
  )
  .pattern("pipeline")
  .channel("wf-30-sidebar-skeleton")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI loading state designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: SidebarSkeleton.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct SidebarSkeleton: View
- Shows 5-6 SkeletonRow placeholders that mimic the TrajectoryRow layout
- Each SkeletonRow (private struct) layout:
  - Row 1: A wide rounded rectangle (70% width, 14pt height) for title placeholder
  - Row 2: HStack of 3 small rounded rectangles (status badge ~60pt, agents ~50pt, chapters ~50pt) at 10pt height
  - Row 3: HStack of 2-3 small capsule shapes for tag placeholders (~40-60pt wide, 8pt height)
  - Row 4: A narrow rounded rectangle (~80pt, 8pt height) for timestamp
  - Spacing matches TrajectoryRow: spacingSM vertical between rows
  - Bottom: thin line matching RuleLine
- Shimmer animation:
  - Use a gradient overlay that slides from left to right continuously
  - @State var shimmerOffset: CGFloat with animation .linear(duration: 1.5).repeatForever(autoreverses: false)
  - Gradient: clear -> Theme.borderLight.opacity(0.4) -> clear
  - Apply as mask or overlay on the skeleton shapes
- All placeholder shapes use Theme.borderLight color at ~0.3 opacity as base
- Padding: spacingMD horizontal, spacingSM vertical per row
- VStack of 5-6 SkeletonRow instances
- Assume Theme is available from Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "SidebarSkeleton" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Sidebar/SidebarSkeleton.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Sidebar/SidebarSkeleton.swift.
Create the directory trail-viewer/Sources/Views/Sidebar/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Sidebar/SidebarSkeleton.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Sidebar/SidebarSkeleton.swift && git commit -m "feat: add SidebarSkeleton — shimmer loading placeholder for sidebar"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("30-sidebar-skeleton:", result.status);
