import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("34-detail-skeleton")
  .description(
    "Create trail-viewer/Sources/Views/Detail/DetailSkeleton.swift — skeleton loading for detail view",
  )
  .pattern("pipeline")
  .channel("wf-34-detail-skeleton")
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
    task: `Output the COMPLETE contents of a SwiftUI file: DetailSkeleton.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct DetailSkeleton: View
- Mimics the detail view layout with placeholder shapes:
  Header section:
  - Large SkeletonLine for title (~60% width, 20pt height)
  - Medium SkeletonLine for description (~80% width, 14pt height)
  - Row of 3 small SkeletonLines for metadata (~50pt, ~60pt, ~100pt at 10pt height)
  - Row of 2-3 capsule shapes for tags (~50-70pt, 8pt height)
  - Thick divider line (matching TrajectoryHeaderView's bottom rule)
  Chapter blocks (2-3 of them):
  - Chapter heading: SkeletonLine (~40% width, 16pt height)
  - 4-5 event lines: alternating widths (60-90% width, 12pt height) with small circles on the left (mimicking timeline dots)
  - Spacing between chapters: spacingXXL
- Shimmer animation:
  - @State var shimmerPhase: CGFloat
  - Animate with .linear(duration: 1.5).repeatForever(autoreverses: false)
  - Gradient overlay: clear -> Theme.borderLight.opacity(0.3) -> clear, sliding left to right
- All placeholder shapes: RoundedRectangle(cornerRadius: 4) in Theme.borderLight.opacity(0.2)
- Max width 720pt centered (matching detail view)
- Padding: spacingXXL horizontal, spacingLG vertical
- Background: Theme.pageBg
- Assume Theme is available from Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "DetailSkeleton" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Detail/DetailSkeleton.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/DetailSkeleton.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/DetailSkeleton.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/DetailSkeleton.swift && git commit -m "feat: add DetailSkeleton — shimmer loading placeholder for detail view"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("34-detail-skeleton:", result.status);
