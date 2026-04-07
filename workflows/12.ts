import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("12-skeleton-view")
  .description(
    "Create trail-viewer/Sources/Design/SkeletonView.swift — skeleton loading placeholders with shimmer",
  )
  .pattern("pipeline")
  .channel("wf-12-skeleton-view")
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
    task: `Output the COMPLETE contents of a SkeletonView.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — warm placeholder loading states.

Requirements:

1. Import SwiftUI

2. SkeletonLine: View
   - Properties: width: CGFloat? = nil, height: CGFloat = 12
   - Body: RoundedRectangle(cornerRadius: Theme.radiusSM)
     - Filled with Theme.border.opacity(0.3)
     - Frame: width (or maxWidth .infinity if nil), height
     - Apply .shimmer() modifier (from Animations.swift)

3. SkeletonCard: View
   - Mimics BookCard layout with skeleton lines:
     - VStack(alignment: .leading, spacing: Theme.spacingSM)
     - SkeletonLine(width: 180, height: 16) — title placeholder
     - SkeletonLine(height: 12) — full-width body line
     - SkeletonLine(width: 240, height: 12) — partial body line
     - HStack with three SkeletonLine(width: 60, height: 10) — tag placeholders
   - Padding: Theme.spacingBase
   - Background: Theme.cardBg
   - cornerRadius: Theme.radiusMD
   - Border: Theme.borderLight, 0.5pt

4. SkeletonRow: View
   - Mimics a trajectory list row:
     - HStack(spacing: Theme.spacingSM)
     - Circle skeleton (28x28, shimmer)
     - VStack(alignment: .leading, spacing: 6):
       - SkeletonLine(width: 160, height: 14) — title
       - SkeletonLine(width: 100, height: 10) — subtitle
   - Padding: Theme.spacingSM on vertical, Theme.spacingBase on horizontal

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/12-skeleton-view.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/12-skeleton-view.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/12-skeleton-view.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Design/SkeletonView.swift from this spec:

{{steps.read-spec.output}}

Extract the SkeletonView.swift code and write it to trail-viewer/Sources/Design/SkeletonView.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/SkeletonView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/SkeletonView.swift && git commit -m "feat: add SkeletonView.swift — skeleton loading placeholders with shimmer"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("12-skeleton-view:", result.status);
