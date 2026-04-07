# Spec 96 — Spotlight Integration for Trail Viewer

## Overview

Add CoreSpotlight indexing so trajectories are searchable via macOS Spotlight.
When a user clicks a Spotlight result, Trail Viewer opens and navigates to that trajectory.

Uses the **in-app indexing** approach (no separate mdimporter extension) since the project
is SPM-based. `SpotlightRegistration` is called on app launch to index all trajectories.

---

## FILE 1: `Sources/Services/SpotlightRegistration.swift`

```swift
import CoreSpotlight
import Foundation
import UniformTypeIdentifiers

/// Indexes trajectories into macOS Spotlight via CoreSpotlight.
/// Called on app launch to make trajectories searchable system-wide.
final class SpotlightRegistration {

    static let domainIdentifier = "com.trailviewer.trajectories"

    // MARK: - Index a Single Trajectory

    /// Index one trajectory for Spotlight search.
    /// - Parameters:
    ///   - trajectory: The trajectory to index.
    ///   - fileURL: The on-disk JSON file URL for this trajectory.
    static func indexTrajectory(_ trajectory: Trajectory, at fileURL: URL) {
        let attributeSet = CSSearchableItemAttributeSet(contentType: UTType.json)

        // Core metadata
        attributeSet.title = trajectory.title
        attributeSet.contentDescription = trajectory.description
            ?? trajectory.retrospective?.summary
        attributeSet.kind = trajectory.status.rawValue

        // Tags + agent names as keywords
        var keywords: [String] = trajectory.tags ?? []
        if let agents = trajectory.agents {
            keywords.append(contentsOf: agents.map(\.agentName))
        }
        attributeSet.keywords = keywords

        // Agent names as authors
        attributeSet.authorNames = trajectory.agents?.map(\.agentName)

        // Full-text searchable content
        var textParts: [String] = []

        // Decision questions and chosen answers
        if let decisions = trajectory.decisions {
            for decision in decisions {
                textParts.append("Q: \(decision.question)")
                textParts.append("A: \(decision.chosen)")
                if let reasoning = decision.reasoning {
                    textParts.append(reasoning)
                }
            }
        }

        // Retrospective summary and learnings
        if let retro = trajectory.retrospective {
            textParts.append(retro.summary)
            if let learnings = retro.learnings {
                textParts.append(contentsOf: learnings)
            }
            if let wellItems = retro.whatWentWell {
                textParts.append(contentsOf: wellItems)
            }
            if let improveItems = retro.whatCouldImprove {
                textParts.append(contentsOf: improveItems)
            }
        }

        // Chapter titles and summaries
        for chapter in trajectory.chapters {
            textParts.append(chapter.title)
            if let summary = chapter.summary {
                textParts.append(summary)
            }
        }

        attributeSet.textContent = textParts.joined(separator: "\n")

        // File path so Spotlight knows the source
        attributeSet.contentURL = fileURL
        attributeSet.relatedUniqueIdentifier = trajectory.id

        let item = CSSearchableItem(
            uniqueIdentifier: trajectory.id,
            domainIdentifier: domainIdentifier,
            attributeSet: attributeSet
        )
        // Keep items indexed indefinitely (no expiration)
        item.expirationDate = .distantFuture

        CSSearchableIndex.default().indexSearchableItems([item]) { error in
            if let error {
                print("[Spotlight] Failed to index \(trajectory.id): \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Index All Trajectories

    /// Walk the trajectories directory and index every JSON file found.
    /// Expects structure: `baseDirectory/completed/YYYY-MM/traj_xxx.json`
    static func indexAllTrajectories(from baseDirectory: URL) async {
        let fm = FileManager.default
        let completedDir = baseDirectory.appendingPathComponent("completed")

        guard fm.fileExists(atPath: completedDir.path) else {
            print("[Spotlight] No completed/ directory at \(completedDir.path)")
            return
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        var indexed = 0
        var failed = 0

        // Enumerate all JSON files recursively
        guard let enumerator = fm.enumerator(
            at: completedDir,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            print("[Spotlight] Could not enumerate \(completedDir.path)")
            return
        }

        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension == "json" else { continue }

            do {
                let data = try Data(contentsOf: fileURL)
                let trajectory = try decoder.decode(Trajectory.self, from: data)
                indexTrajectory(trajectory, at: fileURL)
                indexed += 1
            } catch {
                failed += 1
                print("[Spotlight] Failed to parse \(fileURL.lastPathComponent): \(error.localizedDescription)")
            }
        }

        print("[Spotlight] Indexed \(indexed) trajectories (\(failed) failed)")
    }

    // MARK: - Remove from Index

    /// Remove a single trajectory from Spotlight.
    static func removeTrajectory(_ id: String) {
        CSSearchableIndex.default().deleteSearchableItems(
            withIdentifiers: [id]
        ) { error in
            if let error {
                print("[Spotlight] Failed to remove \(id): \(error.localizedDescription)")
            }
        }
    }

    /// Remove all Trail Viewer trajectories from Spotlight.
    static func removeAllTrajectories() {
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: [domainIdentifier]
        ) { error in
            if let error {
                print("[Spotlight] Failed to remove all: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Handle Spotlight Result Tap

    /// Extract a trajectory ID from a Spotlight continuation activity.
    /// Returns the trajectory ID if the activity is a Spotlight search action.
    static func handleSpotlightActivity(_ userActivity: NSUserActivity) -> String? {
        guard userActivity.activityType == CSSearchableItemActionType else {
            return nil
        }
        return userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String
    }
}
```

---

## FILE 2: Info.plist (Spotlight Activity Declaration)

For a pure SwiftUI SPM app, we handle the Spotlight continuation activity
via `.onContinueUserActivity` in the app's `body`. No separate Info.plist
file is strictly required for CoreSpotlight indexing — the framework handles
registration when you call `indexSearchableItems`.

However, if a formal `Info.plist` is needed (e.g., for the URL scheme or
activity type declaration), place it at `trail-viewer/Sources/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Declare that this app handles Spotlight search continuation -->
    <key>NSUserActivityTypes</key>
    <array>
        <string>com.apple.corespotlight.SearchableItemActionType</string>
    </array>

    <!-- URL scheme for deep-linking into trajectories -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>com.trailviewer.trajectory</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>trailviewer</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

---

## FILE 3: Updated `Package.swift`

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
            path: "Sources",
            linkerSettings: [
                .linkedFramework("CoreSpotlight")
            ]
        )
    ]
)
```

**Diff from current:**
```diff
         .executableTarget(
             name: "TrailViewer",
-            path: "Sources"
+            path: "Sources",
+            linkerSettings: [
+                .linkedFramework("CoreSpotlight")
+            ]
         )
```

---

## App Integration (Changes to `TrailViewerApp.swift`)

Add the `.onContinueUserActivity` handler to the main window and call
`indexAllTrajectories` on launch. Changes to `TrailViewerApp.swift`:

### 1. Add import at top of file

```swift
import CoreSpotlight
```

### 2. Add Spotlight handler to the WindowGroup body

Inside the `WindowGroup` body, chain onto the `ContentView`:

```swift
.onContinueUserActivity(CSSearchableItemActionType) { userActivity in
    if let trajectoryId = SpotlightRegistration.handleSpotlightActivity(userActivity) {
        trajectoryStore.selectTrajectory(byId: trajectoryId)
    }
}
```

### 3. Add Spotlight indexing to `onAppear()`

At the end of the `onAppear()` method, after loading trajectories:

```swift
// Index all trajectories for Spotlight search
let trajectoriesDir = URL(fileURLWithPath: appStateStore.currentPath)
    .appendingPathComponent(".trajectories")
Task.detached(priority: .utility) {
    await SpotlightRegistration.indexAllTrajectories(from: trajectoriesDir)
}
```

### 4. Add a `selectTrajectory(byId:)` method to `TrajectoryStore`

The store needs a method to select a trajectory by ID for Spotlight navigation:

```swift
/// Select a trajectory by its ID (used for Spotlight deep-linking).
@MainActor
func selectTrajectory(byId id: String) {
    if let trajectory = trajectories.first(where: { $0.id == id }) {
        selectedTrajectory = trajectory
    }
}
```

> **Note:** If `TrajectoryStore` already has a selection mechanism, use that instead.
> The key requirement is that clicking a Spotlight result navigates to the matching trajectory.

---

## How It Works

1. **On app launch**, after trajectories load, `SpotlightRegistration.indexAllTrajectories()`
   walks `.trajectories/completed/` and indexes every JSON file into CoreSpotlight.

2. **Spotlight indexes** each trajectory with title, description, tags, agent names, decisions,
   retrospective content, and chapter titles — all fully searchable.

3. **When a user searches** in Spotlight and clicks a Trail Viewer result, macOS delivers an
   `NSUserActivity` with type `CSSearchableItemActionType`. The app's
   `.onContinueUserActivity` handler extracts the trajectory ID and navigates to it.

4. **Incremental updates**: When new trajectories are added or removed, call
   `indexTrajectory(_:at:)` or `removeTrajectory(_:)` individually. The full re-index
   on launch is idempotent (CSSearchableItem updates existing entries by `uniqueIdentifier`).

---

## Testing

1. Build and run Trail Viewer with some trajectories in `.trajectories/completed/`.
2. Check Console.app for `[Spotlight]` log messages confirming indexing.
3. Open Spotlight (Cmd+Space) and search for a trajectory title or tag.
4. Click the result — Trail Viewer should open and show that trajectory.
5. Verify `removeAllTrajectories()` clears results from Spotlight.
