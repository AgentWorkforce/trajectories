# LayoutConstants.swift — Complete File Contents

```swift
import SwiftUI

// MARK: - LayoutConstants

/// Layout-specific dimensions extending the Theme design system.
/// Pure namespace — no instances.
enum LayoutConstants {

    // MARK: Sidebar

    static let sidebarWidth: CGFloat = 250
    static let sidebarMinWidth: CGFloat = 200
    static let sidebarMaxWidth: CGFloat = 350

    // MARK: Chat Panel

    static let chatPanelWidth: CGFloat = 340
    static let chatPanelMinWidth: CGFloat = 280
    static let chatPanelMaxWidth: CGFloat = 500

    // MARK: Content

    static let contentMaxWidth: CGFloat = 720
    static let contentPadding: CGFloat = 32

    // MARK: Header

    static let headerHeight: CGFloat = 52
    static let statusBarHeight: CGFloat = 28

    // MARK: Timeline

    static let timelineRailWidth: CGFloat = 48
    static let timelineDotSize: CGFloat = 8
    static let timelineLineWidth: CGFloat = 1.5

    // MARK: Cards

    static let cardPadding: CGFloat = 16
    static let cardSpacing: CGFloat = 12

    // MARK: Window

    static let minWindowWidth: CGFloat = 900
    static let minWindowHeight: CGFloat = 600
    static let defaultWindowWidth: CGFloat = 1200
    static let defaultWindowHeight: CGFloat = 800
}
```
