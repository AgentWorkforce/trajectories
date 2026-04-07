import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("45-confidence-meter")
  .description(
    "Create trail-viewer/Sources/Views/Detail/ConfidenceMeter.swift — reusable gradient confidence bar",
  )
  .pattern("pipeline")
  .channel("wf-45-confidence-meter")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI component designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: ConfidenceMeter.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct ConfidenceMeter: View
- Properties:
  - value: Double (0.0 to 1.0)
  - label: String? = nil (optional label like "Overall Confidence")
  - isCompact: Bool = false (compact mode for inline use vs expanded mode)
- Layout:
  Expanded mode (default):
  - VStack(alignment: .leading, spacing: spacingSM ~8pt):
    1. If label is present: Text(label) in Typography.caption, Theme.textTertiary
    2. HStack:
       - Large percentage number: Text("{Int(value * 100)}") in Typography.chapterTitle (serif, large ~28pt), Theme.textPrimary
       - "% confident" in Typography.body, Theme.textSecondary
    3. Bar:
       - Full width horizontal bar, height ~8pt
       - Background: Theme.borderLight (the unfilled track)
       - Fill: LinearGradient from Theme.yellowLight to Theme.blue, filling to value percentage
       - Rounded ends: Capsule clip shape
       - Animate fill on value change with .spring(response: 0.6)
  Compact mode:
  - HStack(spacing: spacingSM):
    1. Text("{Int(value * 100)}%") in Typography.caption, Theme.textPrimary
    2. Bar: same as above but height ~4pt, max width ~80pt
    3. If label: Text(label) in Typography.caption, Theme.textTertiary
- Clamp value to 0.0...1.0 range
- Assume Theme, Typography are available from Design/ folder
- Add a PreviewProvider showing both expanded and compact modes at various confidence levels (30%, 65%, 92%)

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "ConfidenceMeter" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Detail/ConfidenceMeter.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/ConfidenceMeter.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/ConfidenceMeter.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/ConfidenceMeter.swift && git commit -m "feat: add ConfidenceMeter — reusable gradient confidence bar component"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("45-confidence-meter:", result.status);
