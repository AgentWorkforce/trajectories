Created `/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Design/SearchHighlight.swift`.

Summary:
- Wrote the full SwiftUI implementation for `HighlightedText`, `SearchHighlight`, `highlightedText(_:query:)`, the `View.searchHighlight(text:query:)` extension, and preview content.
- Kept the implementation as specified, with one compile-safety adjustment: the helper uses Swift’s native `.caseInsensitive` range search to preserve valid string indices.
- Used `Theme.pageBg` in the preview background because the existing theme defines that symbol instead of `Theme.backgroundPrimary`.

Artifacts produced:
- `trail-viewer/Sources/Design/SearchHighlight.swift`
