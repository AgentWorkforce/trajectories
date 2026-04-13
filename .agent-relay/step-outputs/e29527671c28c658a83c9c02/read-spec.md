# TimelineRail.swift — Complete Implementation

Write this file to `TrailViewer/Sources/Components/TimelineRail.swift`.

```swift
import SwiftUI

// MARK: - TimelineRail

/// A vertical timeline rail that renders a continuous connecting line
/// with significance dots overlaid, and event content to the right.
struct TimelineRail<Content: View>: View {
    let events: [TrajectoryEvent]
    @ViewBuilder let content: (TrajectoryEvent) -> Content

    // MARK: - Constants

    private let railWidth: CGFloat = 24
    private let lineWidth: CGFloat = 2
    private let dotDiameter: CGFloat = 10
    private let eventSpacing: CGFloat = Theme.spacingMD

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                HStack(alignment: .top, spacing: Theme.spacingSM) {
                    // Left column: dot + connecting line
                    railSegment(for: event, isLast: index == events.count - 1)
                        .frame(width: railWidth)

                    // Right column: event card content
                    content(event)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // MARK: - Rail Segment

    /// Renders one segment of the rail: a significance dot with a
    /// vertical line extending below it (omitted for the last event).
    @ViewBuilder
    private func railSegment(for event: TrajectoryEvent, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            SignificanceDot(significance: event.significance)
                .frame(width: dotDiameter, height: dotDiameter)

            if !isLast {
                Rectangle()
                    .fill(Theme.borderLight)
                    .frame(width: lineWidth)
                    .frame(maxHeight: .infinity)
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Preview

#Preview("TimelineRail") {
    let mockEvents: [TrajectoryEvent] = [
        TrajectoryEvent(
            id: "evt-1",
            significance: .critical
        ),
        TrajectoryEvent(
            id: "evt-2",
            significance: .significant
        ),
        TrajectoryEvent(
            id: "evt-3",
            significance: .notable
        ),
        TrajectoryEvent(
            id: "evt-4",
            significance: .routine
        ),
        TrajectoryEvent(
            id: "evt-5",
            significance: .routine
        ),
    ]

    ScrollView {
        TimelineRail(events: mockEvents) { event in
            VStack(alignment: .leading, spacing: 4) {
                Text("Event \(event.id)")
                    .font(Theme.bodyFont)
                    .foregroundStyle(Theme.textPrimary)
                Text("Significance: \(String(describing: event.significance))")
                    .font(Theme.captionFont)
                    .foregroundStyle(Theme.textSecondary)
            }
            .padding(Theme.spacingSM)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surfaceSecondary)
            .cornerRadius(Theme.cornerRadius)
        }
        .padding(Theme.spacingLG)
    }
    .frame(width: 360, height: 500)
    .background(Theme.surfacePrimary)
}
```

## Design Notes

- **Light mode, book-like aesthetic**: The rail uses `Theme.borderLight` for the connecting line — a subtle, understated vertical rule reminiscent of margin lines in a notebook.
- **Generic over Content**: The `@ViewBuilder` closure lets callers render any event card style.
- **Continuous rail**: Each segment draws a dot then a line below it. The last segment omits the line, so the rail terminates cleanly at the final dot.
- **Spacing**: Controlled by `VStack(spacing: 0)` with the line filling the gap naturally — the segment stretches to match the content height on the right.
- **Dependencies**: `SignificanceDot` (from `Design/`), `Theme` (from `Design/`), `TrajectoryEvent` model with `id` and `significance` properties.
