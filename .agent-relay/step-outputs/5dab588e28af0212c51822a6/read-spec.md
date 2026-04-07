# AppConfiguration.swift

```swift
//
//  AppConfiguration.swift
//  Trail Viewer
//
//  App-wide configuration constants for the Trail Viewer macOS application.
//  Defines server URLs, default paths, timeouts, and other settings.
//

import Foundation

enum AppConfiguration {

    // MARK: - Server URLs

    /// Base URL for the local Trail Viewer HTTP server.
    static let serverBaseURL: URL = URL(string: "http://localhost:3847")!

    /// Base URL for the local Trail Viewer WebSocket server.
    static let wsBaseURL: URL = URL(string: "ws://localhost:3847")!

    // MARK: - Paths

    /// Default directories to scan for trajectory data.
    static let defaultTrajectoryPaths: [String] = [
        "~/.trajectories",
        "./trajectories",
        "./trail-data"
    ]

    // MARK: - Timeouts

    /// Maximum time (in seconds) to wait for the embedded server to start.
    static let serverStartupTimeout: TimeInterval = 15.0

    // MARK: - Limits

    /// Maximum number of recently-opened paths to remember.
    static let maxRecentPaths: Int = 10

    // MARK: - App Identity

    /// Display name of the application.
    static let appName: String = "Trail Viewer"

    /// Current application version.
    static let appVersion: String = "1.0.0"
}
```
