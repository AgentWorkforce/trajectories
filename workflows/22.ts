import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("22-trajectory-store")
  .description(
    "Create trail-viewer/Sources/Data/TrajectoryStore.swift — @Observable store for trajectories, filtering, selection",
  )
  .pattern("pipeline")
  .channel("wf-22-trajectory-store")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift state management architect",
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
    task: `Output the COMPLETE contents of a TrajectoryStore.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable macro)

3. @Observable class TrajectoryStore:

   Properties:
   - private(set) var trajectories: [TrajectorySummary] = []
   - var selectedTrajectory: Trajectory? = nil
   - private(set) var stats: TrajectoryStats = .empty
   - private(set) var isLoading: Bool = false
   - private(set) var isLoadingDetail: Bool = false
   - private(set) var error: APIError? = nil
   - var searchText: String = ""
   - var statusFilter: TrajectoryStatus? = nil
   - var selectedTags: Set<String> = []
   - private let apiClient: APIClient

   Initializer:
   - init(apiClient: APIClient = APIClient())

   Computed properties:

   filteredTrajectories: [TrajectorySummary]
   - Start with trajectories array
   - If searchText is not empty, filter by title containing searchText (case insensitive)
   - If statusFilter is not nil, filter by status match
   - If selectedTags is not empty, filter by trajectories whose tags intersect with selectedTags
   - Return filtered result

   allTags: [String]
   - Collect all unique tags from trajectories, sorted alphabetically

   Methods:

   loadTrajectories() async:
   - Set isLoading = true, error = nil
   - do/catch:
     - Call apiClient.listTrajectories(status: statusFilter, search: searchText.isEmpty ? nil : searchText, tags: selectedTags.isEmpty ? nil : Array(selectedTags))
     - Assign result to trajectories
     - Also load stats via apiClient.getStats()
   - Catch: set error
   - Finally: set isLoading = false

   selectTrajectory(id: String) async:
   - Set isLoadingDetail = true
   - do/catch:
     - Call apiClient.getTrajectory(id: id)
     - Assign result to selectedTrajectory
   - Catch: set error
   - Finally: set isLoadingDetail = false

   clearSelection():
   - selectedTrajectory = nil

   refreshStats() async:
   - do/catch: stats = try await apiClient.getStats()
   - Catch: (silently ignore or log)

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "TrajectoryStore" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/TrajectoryStore.swift from this spec:

{{steps.plan.output}}

Extract the TrajectoryStore.swift code and write it to trail-viewer/Sources/Data/TrajectoryStore.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/TrajectoryStore.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/TrajectoryStore.swift && git commit -m "feat: add TrajectoryStore.swift — @Observable store with filtering and selection"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("22-trajectory-store:", result.status);
