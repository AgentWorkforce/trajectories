# Package.swift Specification

## File: `Package.swift`

```swift
// swift-tools-version: 5.9
// Package.swift - Trail Viewer Mac App
//
// A native macOS application for viewing and exploring
// agent workflow trajectories built with SwiftUI.

import PackageDescription

let package = Package(
    name: "TrailViewer",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "TrailViewer",
            path: "Sources"
        )
    ]
)
```

## Notes
- No external dependencies — uses only SwiftUI and Foundation from the platform SDK
- Requires macOS 14 (Sonoma) or later
- Sources directory should contain the SwiftUI `@main` App entry point and all views/models
