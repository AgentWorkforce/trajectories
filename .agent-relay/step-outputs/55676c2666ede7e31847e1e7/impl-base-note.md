Created the requested files in `trail-viewer/Sources/Views/Detail/Events`:

- [EventCardBase.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Detail/Events/EventCardBase.swift)
- [NoteEventView.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Detail/Events/NoteEventView.swift)

The `Events/` directory was created as needed, and both files were written to disk from the provided spec.

Verification: `swift build` does not currently pass for this package, but the failures are pre-existing and outside these new files. The reported issues are elsewhere in the repo, including missing `PreviewsMacros`, missing `Theme.green`, missing `Typography`, and existing model/API mismatches in sidebar/data sources.
