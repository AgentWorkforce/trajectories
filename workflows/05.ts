import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("05-typography")
  .description(
    "Create trail-viewer/Sources/Design/Typography.swift — serif headings and body font ViewModifiers",
  )
  .pattern("pipeline")
  .channel("wf-05-typography")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI typography architect",
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
    task: `Output the COMPLETE contents of a Typography.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — serif headings for a book-like reading experience.

Requirements:

1. Import SwiftUI

2. Create ViewModifier structs for each typography style, each setting font + foregroundColor:

   - ChapterTitleStyle: .system(size: 26, weight: .bold, design: .serif), Theme.textPrimary
   - SectionTitleStyle: .system(size: 18, weight: .semibold, design: .serif), Theme.textPrimary
   - HeadingStyle: .system(size: 15, weight: .semibold), Theme.textPrimary
   - BodyStyle: .system(size: 13.5), Theme.textSecondary, with .lineSpacing(13.5 * 0.6) for 1.6x
   - BodySmallStyle: .system(size: 12), Theme.textSecondary
   - CaptionStyle: .system(size: 11, weight: .medium), Theme.textTertiary
   - CodeStyle: .system(size: 12, design: .monospaced), Theme.textPrimary
   - LabelStyle (renamed to TrailLabelStyle to avoid SwiftUI conflict): .system(size: 10, weight: .bold), Theme.textTertiary, with .textCase(.uppercase) and .tracking(0.5)

3. Each ViewModifier struct conforms to ViewModifier with func body(content: Content) -> some View

4. Add View extension with convenience methods:
   - .chapterTitle() -> applies ChapterTitleStyle
   - .sectionTitle() -> applies SectionTitleStyle
   - .heading() -> applies HeadingStyle
   - .bodyStyle() -> applies BodyStyle
   - .bodySmall() -> applies BodySmallStyle
   - .caption() -> applies CaptionStyle
   - .codeStyle() -> applies CodeStyle
   - .trailLabel() -> applies TrailLabelStyle

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "ChapterTitleStyle" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/Typography.swift from this spec:

{{steps.plan.output}}

Extract the Typography.swift code and write it to trail-viewer/Sources/Design/Typography.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/Typography.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/Typography.swift && git commit -m "feat: add Typography.swift — serif headings and body font ViewModifiers"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("05-typography:", result.status);
