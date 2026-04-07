import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("31-trajectory-header-view")
  .description(
    "Create trail-viewer/Sources/Views/Detail/TrajectoryHeaderView.swift — detail header with title, metadata, tags, and rule line",
  )
  .pattern("pipeline")
  .channel("wf-31-trajectory-header")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI detail header designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: TrajectoryHeaderView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct TrajectoryHeaderView: View
- Property: trajectory: Trajectory (the full model, not summary)
- Assume Trajectory model has: id, task (String), description (String?), status (TrajectoryStatus), agents ([AgentInfo]), startedAt (Date), completedAt (Date?), tags ([String]), source (String?)
- Assume AgentInfo has: name (String), role (String?)
- Layout (VStack, alignment: .leading, spacing: spacingMD ~12pt):
  1. Title: trajectory.task in Typography.chapterTitle (serif .design(.serif), ~24pt, Theme.textPrimary)
  2. Description: trajectory.description in Typography.body if present, Theme.textSecondary color
  3. Metadata row (HStack, spacing: spacingMD):
     - StatusBadge(status: trajectory.status)
     - Agent names: joined comma-separated, in Typography.caption
     - Date range: "Started {date}" or "Started {date} — Completed {date}" in Typography.caption, Theme.textTertiary
  4. Tags row: HStack wrapping flow of TagPill(tag) for each trajectory.tags item
  5. Source link: if trajectory.source is present, show Link or Button with link.circle SF Symbol + source URL text in Theme.blue, Typography.caption
  6. Bottom: thick RuleLine (2pt) in Theme.borderLight
- Padding: spacingXXL (~32pt) horizontal, spacingLG (~20pt) vertical
- Assume Theme, Typography, StatusBadge, TagPill, RuleLine are available from Design/ folder
- Add a PreviewProvider with mock Trajectory data

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/31-trajectory-header.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/31-trajectory-header.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/31-trajectory-header.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Detail/TrajectoryHeaderView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/TrajectoryHeaderView.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/TrajectoryHeaderView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/TrajectoryHeaderView.swift && git commit -m "feat: add TrajectoryHeaderView — detail header with title, metadata, and tags"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("31-trajectory-header-view:", result.status);
