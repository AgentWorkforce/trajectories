Created [QuickLookGenerator.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Services/QuickLookGenerator.swift) and [TrajectoryPreviewCard.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/TrajectoryPreviewCard.swift).

`QuickLookGenerator.swift` adds async preview generation via `POST /api/previews/generate`, expands `~` paths, maps failures to existing `APIError` cases, and locates generated `.html` previews by trajectory ID under the completed-trajectories tree. `TrajectoryPreviewCard.swift` adds a compact `BookCard`-styled SwiftUI preview with title, status, agent/chapter counts, tags, optional reflected retrospective/confidence fields, and relative timestamp.

Verification:
- Focused typecheck for the new files and their direct dependencies passed.
- Full `swift build` still fails due pre-existing repo issues outside these files, including errors in  lipboardService.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Services/ClipboardService.swift),  hatPanelView.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Chat/ChatPanelView.swift), and other existing preview/build mismatches.

Artifacts produced:
- `trail-viewer/Sources/Services/QuickLookGenerator.swift`
- `trail-viewer/Sources/Views/TrajectoryPreviewCard.swift`
