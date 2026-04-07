# TrailViewerApp.swift — App Entry Point Spec

## Complete File Contents

```swift
// Trail Viewer — macOS app entry point

import SwiftUI

@main
struct TrailViewerApp: App {
    var body: some Scene {
        WindowGroup("Trail Viewer") {
            Text("Trail Viewer")
                .frame(minWidth: 900, minHeight: 600)
                .preferredColorScheme(.light)
        }
        .defaultSize(width: 1200, height: 800)
        .windowResizability(.contentMinSize)
    }
}
```

## Notes

- `@main` marks this as the app entry point
- `WindowGroup("Trail Viewer")` sets the window title
- `.frame(minWidth: 900, minHeight: 600)` enforces minimum window size
- `.windowResizability(.contentMinSize)` tells macOS to respect the min size constraint
- `.defaultSize(width: 1200, height: 800)` sets the initial window dimensions
- `.preferredColorScheme(.light)` forces light mode only
- The `Text("Trail Viewer")` is a placeholder to be replaced with the actual content view
