import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("48-trajectory-detail-view")
  .description(
    "Create trail-viewer/Sources/Views/Detail/TrajectoryDetailView.swift — main detail container with all sections",
  )
  .pattern("pipeline")
  .channel("wf-48-trajectory-detail")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI detail view architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: TrajectoryDetailView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct TrajectoryDetailView: View
- @EnvironmentObject var store: TrajectoryStore
- Assume TrajectoryStore provides:
  - selectedTrajectoryId: String?
  - selectedTrajectory: Trajectory? (the full loaded trajectory)
  - isLoadingDetail: Bool
  - detailError: String?
  - loadTrajectoryDetail(id:) async
- Assume Trajectory model has: id, task, description, status, agents, startedAt, completedAt, tags, source, chapters ([Chapter]), retrospective (Retrospective?), filesChanged ([String]), commits ([CommitInfo])
- @State private var selectedChapterId: String? = nil
- @State private var scrollProxy: ScrollViewProxy? (for programmatic scrolling)
- Layout:
  If store.selectedTrajectoryId is nil:
  - Centered EmptyState view: "book.closed.fill" SF Symbol + "Select a trajectory" message + "Choose a trajectory from the sidebar to view its story" subtitle
  - Full height, Theme.pageBg background
  If store.isLoadingDetail:
  - DetailSkeleton view
  If store.detailError != nil:
  - Error state with retry button
  If store.selectedTrajectory is present:
  - ScrollViewReader { proxy in ScrollView(.vertical, showsIndicators: true) }
  - VStack(alignment: .leading, spacing: 0) inside scroll:
    1. TrajectoryHeaderView(trajectory: trajectory)
    2. ChapterNavigation(chapters: trajectory.chapters, selectedChapterId: $selectedChapterId, onChapterTap: { id in scroll to id })
    3. ForEach(trajectory.chapters) { chapter in ChapterView(chapter: chapter) }.id(chapter.id) for scroll targeting
    4. If trajectory.retrospective is present: RetrospectiveView(retrospective: trajectory.retrospective)
    5. FileChangesView(files: trajectory.filesChanged, commits: trajectory.commits)
  - Max width: 720pt centered using .frame(maxWidth: 720).frame(maxWidth: .infinity)
  - Background: Theme.pageBg (#faf8f5)
  - Padding: spacingXXL (~32pt) horizontal on the scroll content
  - .onChange(of: store.selectedTrajectoryId): reset scroll to top, clear selectedChapterId, load detail
  - .task: load detail on appear if selectedTrajectoryId is set
- Assume all sub-views (TrajectoryHeaderView, ChapterNavigation, ChapterView, RetrospectiveView, FileChangesView, DetailSkeleton, EmptyState) are available
- Assume Theme, Typography are available from Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "TrajectoryDetailView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Detail/TrajectoryDetailView.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/TrajectoryDetailView.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/TrajectoryDetailView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/TrajectoryDetailView.swift && git commit -m "feat: add TrajectoryDetailView — main detail container with all sections"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("48-trajectory-detail-view:", result.status);
