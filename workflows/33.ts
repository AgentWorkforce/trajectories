import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("33-timeline-rail")
  .description(
    "Create trail-viewer/Sources/Views/Detail/TimelineRail.swift — vertical timeline with dots and connecting lines",
  )
  .pattern("pipeline")
  .channel("wf-33-timeline-rail")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI timeline designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: TimelineRail.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct TimelineRail<Content: View>: View (generic over content)
- Properties:
  - events: [TrajectoryEvent] (assume it has: id, significance (EventSignificance enum: routine, notable, significant, critical))
  - @ViewBuilder content: (TrajectoryEvent) -> Content
- Layout:
  - For each event, an HStack:
    - Left column (fixed ~24pt width, centered):
      - SignificanceDot for the event (assume SignificanceDot is available from Design/ folder, takes significance)
      - Vertical connecting line (2pt wide Rectangle in Theme.borderLight) stretching between dots
      - Last event has no connecting line below
    - Right column: content(event) — the event card content
  - The vertical line runs continuously on the left edge, connecting all SignificanceDots
  - Use GeometryReader or ZStack approach for the continuous line with dots overlaid
  - Alternative simpler approach: VStack of event rows, each row has the dot + line segment on the left
- Spacing between events: spacingMD (~12pt)
- The rail line color: Theme.borderLight (2pt width)
- Assume SignificanceDot, Theme are available from Design/ folder
- Add a PreviewProvider with mock events and simple Text content

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/33-timeline-rail.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/33-timeline-rail.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/33-timeline-rail.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Detail/TimelineRail.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/TimelineRail.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/TimelineRail.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/TimelineRail.swift && git commit -m "feat: add TimelineRail — vertical timeline with dots and connecting lines"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("33-timeline-rail:", result.status);
