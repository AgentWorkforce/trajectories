import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("29-trajectory-list-view")
  .description(
    "Create trail-viewer/Sources/Views/Sidebar/TrajectoryListView.swift — main sidebar with header, filter, and scrollable trajectory list",
  )
  .pattern("pipeline")
  .channel("wf-29-trajectory-list")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI sidebar architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: TrajectoryListView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct TrajectoryListView: View
- Use @EnvironmentObject var store: TrajectoryStore (assume it provides: trajectories, filteredTrajectories, isLoading, error, searchText, statusFilter, selectedTrajectoryId, selectTrajectory(id:), loadTrajectories())
- Layout (VStack, spacing: 0):
  1. SidebarHeader (shows trajectory count and active count from store)
  2. FilterBar (bindings to store.searchText and store.statusFilter)
  3. Main content area (conditional):
     - If store.isLoading && store.trajectories.isEmpty: SidebarSkeleton (loading placeholder)
     - If store.error != nil: subtle error banner — HStack with exclamationmark.triangle icon + error message in caption, orange-tinted background, rounded, with padding
     - If store.filteredTrajectories.isEmpty && !store.isLoading: EmptyState view with "book.closed" SF Symbol and "No trajectories found" message
     - Otherwise: ScrollView with LazyVStack of TrajectoryRow items
       - Each row: TrajectoryRow(trajectory: item, isSelected: item.id == store.selectedTrajectoryId)
       - onTapGesture: store.selectTrajectory(id: item.id)
       - List style: .plain equivalent (no default list chrome)
       - Animation: .animation(.easeInOut(duration: 0.2), value: store.filteredTrajectories.map(\\.id))
- Background: Theme.sidebarBg for the entire view
- .onAppear { store.loadTrajectories() }
- Frame: minWidth 280, idealWidth 320, maxWidth 380
- Assume SidebarHeader, FilterBar, TrajectoryRow, SidebarSkeleton, EmptyState, Theme are all available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/29-trajectory-list.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/29-trajectory-list.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/29-trajectory-list.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Sidebar/TrajectoryListView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Sidebar/TrajectoryListView.swift.
Create the directory trail-viewer/Sources/Views/Sidebar/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Sidebar/TrajectoryListView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Sidebar/TrajectoryListView.swift && git commit -m "feat: add TrajectoryListView — main sidebar with header, filter, and trajectory list"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("29-trajectory-list-view:", result.status);
