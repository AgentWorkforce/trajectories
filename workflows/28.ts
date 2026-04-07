import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("28-trajectory-row")
  .description(
    "Create trail-viewer/Sources/Views/Sidebar/TrajectoryRow.swift — rich trajectory list row with status, tags, timestamp",
  )
  .pattern("pipeline")
  .channel("wf-28-trajectory-row")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI list row designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: TrajectoryRow.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct TrajectoryRow: View
- Properties: trajectory: TrajectorySummary, isSelected: Bool
- Assume TrajectorySummary model has: id, task (String), status (TrajectoryStatus), agentCount (Int), chapterCount (Int), tags ([String]), updatedAt (Date)
- Layout (VStack, alignment: .leading, spacing: spacingSM ~8pt):
  Row 1: Task title in Typography.heading style, single line, .lineLimit(1) truncated
  Row 2: HStack — StatusBadge(status: trajectory.status) + Text("{N} agents") + Text("{N} chapters") all in Typography.caption
  Row 3: Horizontal ScrollView (.horizontal, showsIndicators: false) of TagPill views for each tag
  Row 4: Relative timestamp in Typography.caption, Theme.textTertiary color — use the RelativeTimeFormatter helper
- Selected state:
  - Left blue border: 3pt Rectangle in Theme.blue on the leading edge (overlay or HStack approach)
  - Background: Theme.yellowMuted (golden highlight)
- Unselected state: clear background
- Bottom: RuleLine divider
- Padding: spacingMD horizontal, spacingSM vertical
- Include a RelativeTimeFormatter helper:
  - Private helper or extension that converts Date to relative string ("2m ago", "1h ago", "3d ago")
  - Use RelativeDateTimeFormatter or manual calculation
- Assume Theme, Typography, StatusBadge, TagPill, RuleLine are available from Design/ folder
- Add a PreviewProvider with mock data for both selected and unselected states

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/28-trajectory-row.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/28-trajectory-row.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/28-trajectory-row.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Sidebar/TrajectoryRow.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Sidebar/TrajectoryRow.swift.
Create the directory trail-viewer/Sources/Views/Sidebar/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Sidebar/TrajectoryRow.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Sidebar/TrajectoryRow.swift && git commit -m "feat: add TrajectoryRow — rich sidebar row with status, tags, and relative time"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("28-trajectory-row:", result.status);
