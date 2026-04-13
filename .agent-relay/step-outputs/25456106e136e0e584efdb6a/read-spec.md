# SidebarSkeleton.swift — Complete File

```swift
import SwiftUI

// MARK: - SidebarSkeleton

struct SidebarSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { _ in
                SidebarSkeletonRow()
            }
            Spacer()
        }
    }
}

// MARK: - SidebarSkeletonRow

private struct SidebarSkeletonRow: View {
    @State private var shimmerOffset: CGFloat = -200

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Row 1: Title placeholder (70% width, 14pt height)
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: geo.size.width * 0.7, height: 14)
            }
            .frame(height: 14)

            // Row 2: Status badge, agents, chapters
            HStack(spacing: Theme.spacingSM) {
                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 60, height: 10)

                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 50, height: 10)

                RoundedRectangle(cornerRadius: Theme.radiusSM)
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 50, height: 10)
            }

            // Row 3: Tag capsules
            HStack(spacing: Theme.spacingXS) {
                Capsule()
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 52, height: 8)

                Capsule()
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 40, height: 8)

                Capsule()
                    .fill(Theme.borderLight.opacity(0.3))
                    .frame(width: 58, height: 8)
            }

            // Row 4: Timestamp placeholder
            RoundedRectangle(cornerRadius: Theme.radiusSM)
                .fill(Theme.borderLight.opacity(0.3))
                .frame(width: 80, height: 8)
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingSM)
        .overlay(
            // Shimmer gradient overlay
            LinearGradient(
                gradient: Gradient(colors: [
                    .clear,
                    Theme.borderLight.opacity(0.4),
                    .clear
                ]),
                startPoint: .leading,
                endPoint: .trailing
            )
            .offset(x: shimmerOffset)
            .animation(
                .linear(duration: 1.5).repeatForever(autoreverses: false),
                value: shimmerOffset
            )
        )
        .clipped()
        .overlay(alignment: .bottom) {
            RuleLine()
        }
        .onAppear {
            shimmerOffset = 200
        }
    }
}

// MARK: - Preview

struct SidebarSkeleton_Previews: PreviewProvider {
    static var previews: some View {
        SidebarSkeleton()
            .frame(width: 280, height: 500)
            .background(Theme.sidebarBg)
            .previewDisplayName("SidebarSkeleton — Loading State")
    }
}
```

## Design Notes

- **Layout mirrors TrajectoryRow**: 4-row VStack with identical spacing (`Theme.spacingSM` between rows, `Theme.spacingMD` horizontal padding, `Theme.spacingSM` vertical padding)
- **Row 1 — Title**: Uses `GeometryReader` to get 70% parent width at 14pt height, matching `Typography.heading` line height
- **Row 2 — Metadata**: Three small rectangles (60pt, 50pt, 50pt) at 10pt height, matching `StatusBadge` + caption text sizing
- **Row 3 — Tags**: Capsule shapes (52pt, 40pt, 58pt) at 8pt height, mimicking `TagPill` layout
- **Row 4 — Timestamp**: 80pt x 8pt rectangle matching caption timestamp size
- **Base color**: `Theme.borderLight.opacity(0.3)` — warm neutral that blends with the sidebar background
- **Shimmer**: Per-row `LinearGradient` sliding from x:-200 to x:200 over 1.5s, using `Theme.borderLight.opacity(0.4)` for warmth consistency
- **Bottom divider**: `RuleLine()` via overlay alignment, matching TrajectoryRow separator
- **Count**: 6 skeleton rows to fill a typical sidebar height
- **Dependencies**: `Theme` (Design/), `RuleLine` (Design/SectionElements.swift)
