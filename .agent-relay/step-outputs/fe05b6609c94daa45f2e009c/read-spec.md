# Theme.swift — Trail Viewer Design System

## File: `TrailViewer/Theme.swift`

```swift
import SwiftUI

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard sanitized.count == 6,
              let rgb = UInt64(sanitized, radix: 16) else {
            self = .clear
            return
        }
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Theme

enum Theme {

    // MARK: Page & Surface

    static let pageBg       = Color(hex: "faf8f5")
    static let sidebarBg    = Color(hex: "f0ece4")
    static let cardBg       = Color(hex: "ffffff")
    static let cardHover    = Color(hex: "f8f6f2")
    static let border       = Color(hex: "d4cfc7")
    static let borderLight  = Color(hex: "e8e4dc")

    // MARK: Text

    static let textPrimary   = Color(hex: "2c2825")
    static let textSecondary = Color(hex: "6b6560")
    static let textTertiary  = Color(hex: "9b9590")

    // MARK: Blue (interactive / structural)

    static let blue      = Color(hex: "7eb8da")
    static let blueLight = Color(hex: "b8d9ec")
    static let blueMuted = Color(hex: "e8f1f7")

    // MARK: Yellow (highlights)

    static let yellow      = Color(hex: "f2d479")
    static let yellowLight = Color(hex: "f7e6a8")
    static let yellowMuted = Color(hex: "fdf5e0")

    // MARK: Status

    static let statusActive    = Color(hex: "8fae8b")
    static let statusCompleted = Color(hex: "7eb8da")
    static let statusAbandoned = Color(hex: "c87f6b")

    // MARK: Significance

    static let significanceHigh   = Color(hex: "e8845a")
    static let significanceMedium = Color(hex: "f2d479")
    static let significanceLow    = Color(hex: "b8d9ec")

    // MARK: Error / Success

    static let error     = Color(hex: "c87f6b")
    static let errorBg   = Color(hex: "fdf0ec")
    static let success   = Color(hex: "8fae8b")
    static let successBg = Color(hex: "f0f5ef")

    // MARK: Agent Colors

    static let agentColors: [String: Color] = [
        "agent1": Color(hex: "7eb8da"),
        "agent2": Color(hex: "8fae8b"),
        "agent3": Color(hex: "c9a0dc"),
        "agent4": Color(hex: "f2d479"),
        "agent5": Color(hex: "e8845a"),
        "agent6": Color(hex: "82c4c3"),
    ]

    static func agentColor(for name: String) -> Color {
        let colors = Array(agentColors.values)
        guard !colors.isEmpty else { return blue }
        let hash = abs(name.hashValue)
        return colors[hash % colors.count]
    }

    // MARK: Spacing

    static let spacingXS:   CGFloat = 4
    static let spacingSM:   CGFloat = 8
    static let spacingBase: CGFloat = 12
    static let spacingMD:   CGFloat = 16
    static let spacingLG:   CGFloat = 24
    static let spacingXL:   CGFloat = 36
    static let spacingXXL:  CGFloat = 56

    // MARK: Corner Radii

    static let radiusSM: CGFloat = 3
    static let radiusMD: CGFloat = 6
    static let radiusLG: CGFloat = 10
}
```
