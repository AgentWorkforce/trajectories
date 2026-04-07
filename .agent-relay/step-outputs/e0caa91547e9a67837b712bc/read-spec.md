# FocusManagement.swift — Trail Viewer macOS App

```swift
import SwiftUI

// MARK: - Focus Region

enum AppFocusRegion: Hashable, CaseIterable {
    case sidebar
    case detail
    case chat
    case commandPalette
}

// MARK: - Focus Cycle Modifier

struct FocusCycleModifier: ViewModifier {
    @FocusState private var focusedRegion: AppFocusRegion?

    func body(content: Content) -> some View {
        content
            .focusable()
            .onKeyPress(.tab) { keyPress in
                let allCases = AppFocusRegion.allCases
                let isShift = keyPress.modifiers.contains(.shift)

                if let current = focusedRegion,
                   let index = allCases.firstIndex(of: current) {
                    if isShift {
                        let prevIndex = index == allCases.startIndex
                            ? allCases.index(before: allCases.endIndex)
                            : allCases.index(before: index)
                        focusedRegion = allCases[prevIndex]
                    } else {
                        let nextIndex = allCases.index(after: index)
                        focusedRegion = nextIndex == allCases.endIndex
                            ? allCases[allCases.startIndex]
                            : allCases[nextIndex]
                    }
                } else {
                    focusedRegion = isShift ? .commandPalette : .sidebar
                }

                return .handled
            }
            .overlay {
                if focusedRegion != nil {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.blue.opacity(0.3), lineWidth: 2)
                }
            }
    }
}

extension View {
    func focusCycleEnabled() -> some View {
        self.modifier(FocusCycleModifier())
    }
}

// MARK: - Focus Ring Modifier

struct FocusRingModifier: ViewModifier {
    let isActive: Bool
    var color: Color = .blue

    func body(content: Content) -> some View {
        content
            .overlay {
                if isActive {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(color.opacity(0.3), lineWidth: 2)
                }
            }
            .animation(.easeInOut(duration: 0.15), value: isActive)
    }
}

extension View {
    func focusRing(isActive: Bool, color: Color = .blue) -> some View {
        self.modifier(FocusRingModifier(isActive: isActive, color: color))
    }
}

// MARK: - Preview

struct FocusManagement_Previews: PreviewProvider {
    static var previews: some View {
        FocusRegionDemoView()
            .frame(width: 600, height: 400)
    }
}

private struct FocusRegionDemoView: View {
    @FocusState private var focusedRegion: AppFocusRegion?

    var body: some View {
        HStack(spacing: 12) {
            regionBox(label: "Sidebar", region: .sidebar, baseColor: .purple)
            regionBox(label: "Detail", region: .detail, baseColor: .green)
            regionBox(label: "Chat", region: .chat, baseColor: .orange)
            regionBox(label: "Command Palette", region: .commandPalette, baseColor: .pink)
        }
        .padding()
        .focusCycleEnabled()
    }

    @ViewBuilder
    private func regionBox(label: String, region: AppFocusRegion, baseColor: Color) -> some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(baseColor.opacity(0.2))
            .overlay {
                Text(label)
                    .font(.headline)
                    .foregroundColor(baseColor)
            }
            .focusRing(isActive: focusedRegion == region, color: baseColor)
            .focused($focusedRegion, equals: region)
    }
}
```
