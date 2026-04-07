# SettingsModels.swift — Complete File Contents

```swift
import Foundation

// MARK: - CLIInfo

struct CLIInfo: Codable, Identifiable, Hashable {
    var id: String { name }

    let name: String
    let version: String?
    let path: String
}

// MARK: - CLIAvailability

struct CLIAvailability: Codable, Identifiable, Hashable {
    var id: String { name }

    let name: String
    let info: CLIInfo?
    let isSupportedForChat: Bool

    var isDetected: Bool {
        info != nil
    }

    var displayName: String {
        guard let first = name.first else { return name }
        return String(first).uppercased() + name.dropFirst()
    }

    var statusDescription: String {
        if let version = info?.version {
            return "v\(version)"
        }
        return "Not found"
    }
}

// MARK: - AppPreferences

struct AppPreferences: Codable, Hashable {
    var recentPaths: [String] = []
    var preferredCLI: String? = nil
    var showChatPanel: Bool = true
    var sidebarVisible: Bool = true
    var lastOpenedPath: String? = nil

    static let defaultPreferences = AppPreferences()
}
```
