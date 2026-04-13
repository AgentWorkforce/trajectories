Created [`trail-viewer/Sources/Views/StatusBar.swift`](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/StatusBar.swift) and wrote it to disk.

The file implements the spec as requested:
- `StatusBar: View` with `@EnvironmentObject` access to `TrajectoryStore` and `AppStateStore`
- `serverState` plain property defaulting to `.stopped`
- left connection indicator, centered trajectory count, right shortcut hints
- `Theme.sidebarBg` background, top border overlay, and `LayoutConstants.statusBarHeight`
- helper computed properties for `dotColor`, `statusText`, and `countLabel`

No other files were changed. I verified the file contents after writing it.
