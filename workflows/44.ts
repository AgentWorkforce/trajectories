import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("44-retrospective-view")
  .description(
    "Create trail-viewer/Sources/Views/Detail/RetrospectiveView.swift — epilogue-style retrospective with challenges, learnings, suggestions",
  )
  .pattern("pipeline")
  .channel("wf-44-retrospective")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI retrospective designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: RetrospectiveView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience. This is the epilogue of the trajectory story.

Requirements:
- Import SwiftUI
- Define struct RetrospectiveView: View
- Property: retrospective: Retrospective model (assume it has: summary (String), approach (String?), confidence (Double), challenges ([String]), learnings ([String]), suggestions ([String]), timeSpent (TimeInterval?))
- Layout (VStack, alignment: .leading, spacing: spacingLG ~20pt):
  1. OrnamentDivider with decorative character (assume OrnamentDivider(symbol:) exists in Design/, pass "✦")
  2. "Retrospective" in Typography.chapterTitle, centered (.frame(maxWidth: .infinity)), serif
  3. Summary paragraph: Text(retrospective.summary) in Typography.body, Theme.textPrimary
  4. Approach section (if present):
     - "Approach" in Typography.sectionTitle
     - Text(retrospective.approach) in Typography.body
  5. Confidence meter: ConfidenceMeter(value: retrospective.confidence, label: "Overall Confidence")
     - Assume ConfidenceMeter is available (or will be from workflow 45)
     - Fallback: inline horizontal bar if ConfidenceMeter not yet available
  6. Challenges section (if non-empty):
     - "Challenges" in Typography.sectionTitle
     - ForEach challenges: HStack with Circle(8pt, .orange) bullet + Text in Typography.body
  7. Learnings section (if non-empty):
     - "Learnings" in Typography.sectionTitle
     - ForEach learnings: HStack with lightbulb.fill SF Symbol (Theme.blue, 14pt) + Circle(8pt, Theme.blue) bullet + Text in Typography.body
  8. Suggestions section (if non-empty):
     - "Suggestions" in Typography.sectionTitle
     - ForEach (enumerated) suggestions: HStack with number (index+1, Typography.caption, italic) + Text in Typography.body, italic
  9. Time spent (if present):
     - Formatted duration string ("Completed in 2h 34m") in Typography.caption, Theme.textTertiary, centered
- Background: Theme.yellowMuted wash over the entire view
- Rounded corners: cornerRadius 8
- Padding: spacingXXL (~32pt) inside
- Assume Theme, Typography, OrnamentDivider, ConfidenceMeter are available from Design/ folder
- Add a PreviewProvider with rich mock retrospective data

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/44-retrospective.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/44-retrospective.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/44-retrospective.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Detail/RetrospectiveView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/RetrospectiveView.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/RetrospectiveView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/RetrospectiveView.swift && git commit -m "feat: add RetrospectiveView — epilogue with challenges, learnings, and suggestions"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("44-retrospective-view:", result.status);
