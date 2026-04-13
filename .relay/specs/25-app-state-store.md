# AppStateStore.swift — Complete File Contents

```swift
import Foundation
import SwiftUI
import AppKit

@Observable
class AppStateStore {

    // MARK: - Static Keys & Limits

    static let recentPathsKey = "AppStateStore.recentPaths"
    static let currentPathKey = "AppStateStore.currentPath"
    static let showChatPanelKey = "AppStateStore.showChatPanel"
    static let sidebarVisibleKey = "AppStateStore.sidebarVisible"
    static let selectedTabKey = "AppStateStore.selectedTab"
    static let maxRecentPaths = 10

    // MARK: - Properties

    var recentPaths: [String] = [] {
        didSet { persistState() }
    }

    var currentPath: String? = nil {
        didSet { persistState() }
    }

    var showChatPanel: Bool = true {
        didSet { persistState() }
    }

    var sidebarVisible: Bool = true {
        didSet { persistState() }
    }

    var selectedTab: String = "trajectories" {
        didSet { persistState() }
    }

    // MARK: - Initializer

    init() {
        loadState()
    }

    // MARK: - Methods

    func addRecentPath(_ path: String) {
        recentPaths.removeAll { $0 == path }
        recentPaths.insert(path, at: 0)
        if recentPaths.count > Self.maxRecentPaths {
            recentPaths = Array(recentPaths.prefix(Self.maxRecentPaths))
        }
    }

    func openPath() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.message = "Select a trajectory data directory"
        panel.prompt = "Open"

        guard panel.runModal() == .OK, let url = panel.url else {
            return nil
        }

        let path = url.path
        currentPath = path
        addRecentPath(path)
        return path
    }

    func persistState() {
        let defaults = UserDefaults.standard

        if let data = try? JSONEncoder().encode(recentPaths) {
            defaults.set(data, forKey: Self.recentPathsKey)
        }

        defaults.set(currentPath, forKey: Self.currentPathKey)
        defaults.set(showChatPanel, forKey: Self.showChatPanelKey)
        defaults.set(sidebarVisible, forKey: Self.sidebarVisibleKey)
        defaults.set(selectedTab, forKey: Self.selectedTabKey)
    }

    func loadState() {
        let defaults = UserDefaults.standard

        if let data = defaults.data(forKey: Self.recentPathsKey),
           let paths = try? JSONDecoder().decode([String].self, from: data) {
            recentPaths = paths
        } else {
            recentPaths = []
        }

        currentPath = defaults.string(forKey: Self.currentPathKey)

        if defaults.object(forKey: Self.showChatPanelKey) != nil {
            showChatPanel = defaults.bool(forKey: Self.showChatPanelKey)
        } else {
            showChatPanel = true
        }

        if defaults.object(forKey: Self.sidebarVisibleKey) != nil {
            sidebarVisible = defaults.bool(forKey: Self.sidebarVisibleKey)
        } else {
            sidebarVisible = true
        }

        if let tab = defaults.string(forKey: Self.selectedTabKey) {
            selectedTab = tab
        } else {
            selectedTab = "trajectories"
        }
    }

    func clearRecentPaths() {
        recentPaths = []
    }

    func toggleSidebar() {
        sidebarVisible.toggle()
    }

    func toggleChatPanel() {
        showChatPanel.toggle()
    }
}
```

OWNER_DECISION: COMPLETE
REASON: Full AppStateStore.swift contents written to spec file with all required imports, properties with didSet persistence, UserDefaults load/save, NSOpenPanel directory picker, and all utility methods.
