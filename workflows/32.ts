import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("32-chapter-navigation")
  .description(
    "Create trail-viewer/Sources/Views/Detail/ChapterNavigation.swift — horizontal chapter title pill navigation",
  )
  .pattern("pipeline")
  .channel("wf-32-chapter-nav")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI navigation designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: ChapterNavigation.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct ChapterNavigation: View
- Properties:
  - chapters: [Chapter] (assume Chapter has: id, number (Int), title (String))
  - @Binding var selectedChapterId: String?
  - onChapterTap: (String) -> Void (callback to scroll to chapter)
- Layout:
  - ScrollView(.horizontal, showsIndicators: false) containing HStack(spacing: spacingSM ~8pt)
  - Each chapter is a pill/button:
    - Text: "Chapter {number}: {title}" in Typography.caption
    - Shape: Capsule with padding horizontal spacingMD (~12pt), vertical 6pt
    - Selected state: Theme.blue background, white text
    - Unselected state: Theme.cardBg background, Theme.textSecondary text
    - onTapGesture: set selectedChapterId and call onChapterTap(chapter.id)
    - Animation on selection change
  - Compact height: ~40pt total including padding
  - Fixed below header — apply a bottom border (thin RuleLine or 1pt divider)
- Horizontal padding: spacingXXL (~32pt) to align with header
- Background: Theme.pageBg
- Assume Theme, Typography, RuleLine are available
- Add a PreviewProvider with 4-5 mock chapters

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "ChapterNavigation" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Detail/ChapterNavigation.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/ChapterNavigation.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/ChapterNavigation.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/ChapterNavigation.swift && git commit -m "feat: add ChapterNavigation — horizontal chapter pill navigation"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("32-chapter-navigation:", result.status);
