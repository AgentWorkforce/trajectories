import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("08-book-card")
  .description(
    "Create trail-viewer/Sources/Design/BookCard.swift — paper-like card component with selection and highlight states",
  )
  .pattern("pipeline")
  .channel("wf-08-book-card")
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
    task: `Output the COMPLETE contents of a BookCard.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — paper-like cards on a warm background.

Requirements:

1. Import SwiftUI

2. Create a generic struct BookCard<Content: View>: View
   - Properties:
     - isSelected: Bool = false
     - isHighlighted: Bool = false
     - @ViewBuilder content: () -> Content
   - init(isSelected: Bool = false, isHighlighted: Bool = false, @ViewBuilder content: @escaping () -> Content)

3. Body renders:
   - content() inside a VStack(alignment: .leading, spacing: 0)
   - Padding of Theme.spacingBase (12pt) on all sides
   - Background: Theme.cardBg (white) normally, Theme.yellowMuted when isHighlighted
   - cornerRadius: Theme.radiusMD (6pt)
   - Thin border: Theme.borderLight, 0.5pt stroke with rounded corners
   - Subtle shadow: color .black.opacity(0.04), radius 3, y offset 1
   - When isSelected: add a 3pt left border in Theme.blue (overlay a Rectangle on the leading edge, width 3, height full, cornerRadius 1.5)
   - On hover: background shifts to Theme.cardHover with Animations.easeOut transition

4. Use @State private var isHovered = false and .onHover modifier for hover state

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/08-book-card.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/08-book-card.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/08-book-card.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Design/BookCard.swift from this spec:

{{steps.read-spec.output}}

Extract the BookCard.swift code and write it to trail-viewer/Sources/Design/BookCard.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/BookCard.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/BookCard.swift && git commit -m "feat: add BookCard.swift — paper-like card with selection and hover states"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("08-book-card:", result.status);
