Created the requested event views in the new `Events` directory:

- [FindingEventView.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Detail/Events/FindingEventView.swift)
- [ThinkingEventView.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Detail/Events/ThinkingEventView.swift)

I also added the required shared wrapper they depend on:

- [EventCardBase.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Detail/Events/EventCardBase.swift)

Verification: `swift build` does not currently pass, but the failures are from unrelated existing issues elsewhere in the package (`#Preview` macro resolution, `CLIDetector.swift`, `TrajectoryStore.swift`, and `TrajectoryListView.swift`). The compiler reached the new event files without reporting errors in them.
