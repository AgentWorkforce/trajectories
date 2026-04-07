import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("43-decision-card")
  .description(
    "Create trail-viewer/Sources/Views/Detail/DecisionCard.swift — visually striking decision display with alternatives and confidence",
  )
  .pattern("pipeline")
  .channel("wf-43-decision-card")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI decision card designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: DecisionCard.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience. This is the MOST visually striking element in the app.

Requirements:
- Import SwiftUI
- Define struct DecisionCard: View
- Properties:
  - decision: Decision model (assume it has: question (String), chosen (String), reasoning (String?), alternatives ([String]), confidence (Double — 0.0 to 1.0))
- @State private var showAlternatives: Bool = false
- Layout (VStack, alignment: .leading, spacing: spacingMD ~12pt):
  1. "DECISION" label: Typography.label style, Theme.blue color, uppercased, letter-spacing/tracking
  2. Question: decision.question in Typography.sectionTitle (serif .design(.serif), ~18pt), Theme.textPrimary
  3. Chosen answer: wrapped in a BookCard-style container (assume BookCard(isHighlighted: Bool) component exists in Design/, or create inline):
     - isHighlighted: true — gives it a slightly elevated, warm appearance
     - HStack: checkmark.circle.fill SF Symbol (Theme.blue) + Text(decision.chosen) in Typography.body
     - Background: Theme.cardBg with subtle shadow or border
  4. Reasoning: if present, Text(decision.reasoning) in Typography.body, italic, Theme.textSecondary
  5. Alternatives section (collapsible):
     - Button: "Show {count} alternatives" / "Hide alternatives" toggle
     - When expanded: VStack of alternative strings in Typography.body, Theme.textTertiary, each with a small circle.fill bullet
     - Animate with .easeInOut(duration: 0.25)
  6. Confidence bar:
     - ConfidenceMeter-style inline bar: horizontal bar with gradient from Theme.yellowLight to Theme.blue
     - Fill to decision.confidence percentage
     - Large number text: "{Int(confidence * 100)}%" + "confident" label
  - Yellow left border: 3pt Rectangle in Theme.yellow (#f2d479) on the leading edge of the entire card
  - Generous padding: spacingLG (~20pt) inside
  - Top and bottom: RuleLine dividers
- Assume Theme, Typography, RuleLine, BookCard are available from Design/ folder
- If BookCard is not available, create a simple highlighted card inline (cardBg background, rounded, subtle shadow)
- Add a PreviewProvider with a rich mock decision

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/43-decision-card.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/43-decision-card.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/43-decision-card.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Detail/DecisionCard.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/DecisionCard.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/DecisionCard.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/DecisionCard.swift && git commit -m "feat: add DecisionCard — striking decision display with confidence and alternatives"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("43-decision-card:", result.status);
