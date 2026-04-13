# BookCard.swift — Complete File Contents

Write this file to `TrailViewer/Components/BookCard.swift`.

```swift
import SwiftUI

struct BookCard<Content: View>: View {
    let isSelected: Bool
    let isHighlighted: Bool
    @ViewBuilder let content: () -> Content

    @State private var isHovered = false

    init(
        isSelected: Bool = false,
        isHighlighted: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isSelected = isSelected
        self.isHighlighted = isHighlighted
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content()
        }
        .padding(Theme.spacingBase)
        .background(backgroundColor)
        .cornerRadius(Theme.radiusMD)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderLight, lineWidth: 0.5)
        )
        .overlay(selectionIndicator, alignment: .leading)
        .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(Animations.easeOut, value: isHovered)
    }

    private var backgroundColor: Color {
        if isHighlighted {
            return Theme.yellowMuted
        }
        if isHovered {
            return Theme.cardHover
        }
        return Theme.cardBg
    }

    @ViewBuilder
    private var selectionIndicator: some View {
        if isSelected {
            Rectangle()
                .fill(Theme.blue)
                .frame(width: 3)
                .cornerRadius(1.5)
                .padding(.vertical, 4)
        }
    }
}
```
