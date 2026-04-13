# Badges.swift — Complete File Contents

```swift
import SwiftUI

// MARK: - StatusBadge

struct StatusBadge: View {
    let status: String

    private var statusColor: Color {
        switch status.lowercased() {
        case "active":
            return Theme.statusActive
        case "completed":
            return Theme.statusCompleted
        case "abandoned":
            return Theme.statusAbandoned
        default:
            return Theme.textTertiary
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)

            Text(status)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(statusColor.opacity(0.1))
        )
    }
}

// MARK: - TagPill

struct TagPill: View {
    let tag: String

    var body: some View {
        Text(tag)
            .font(.system(size: 11))
            .foregroundColor(Theme.blue)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Theme.blueMuted)
            .clipShape(Capsule())
    }
}

// MARK: - SignificanceDot

struct SignificanceDot: View {
    let level: String

    private var significanceColor: Color {
        switch level.lowercased() {
        case "high":
            return Theme.significanceHigh
        case "medium":
            return Theme.significanceMedium
        case "low":
            return Theme.significanceLow
        default:
            return Theme.borderLight
        }
    }

    var body: some View {
        Circle()
            .fill(significanceColor)
            .frame(width: 8, height: 8)
    }
}

// MARK: - AgentAvatar

struct AgentAvatar: View {
    let name: String
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.agentColor(for: name))
                .frame(width: size, height: size)

            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.45, weight: .bold))
                .foregroundColor(.white)
        }
        .clipShape(Circle())
    }
}
```
