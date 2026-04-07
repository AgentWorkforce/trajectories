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
                        .padding(.bottom, index == events.count - 1 ? 0 : eventSpacing)
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

#if false // Disabled: #Preview requires Xcode
#Preview("TimelineRail") {
    let mockEvents: [TrajectoryEvent] = [
        TrajectoryEvent(
            mockId: "evt-1",
            significance: "high"
        ),
        TrajectoryEvent(
            mockId: "evt-2",
            significance: "medium"
        ),
        TrajectoryEvent(
            mockId: "evt-3",
            significance: "low"
        ),
        TrajectoryEvent(
            mockId: "evt-4",
            significance: "low"
        ),
        TrajectoryEvent(
            mockId: "evt-5",
            significance: "low"
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
#endif

// MARK: - Compatibility

private extension SignificanceDot {
    init(significance: String?) {
        self.init(level: significance ?? "")
    }
}

private extension TrajectoryEvent {
    init(mockId: String, significance: String?) {
        self.init(
            ts: Date().timeIntervalSince1970 * 1000,
            type: .note,
            content: "",
            agent: nil,
            significance: significance,
            metadata: nil
        )
    }
}

private extension Theme {
    static let surfacePrimary = pageBg
    static let surfaceSecondary = cardBg
    static let cornerRadius = radiusMD
    static let bodyFont = Font.system(size: 14)
    static let captionFont = Font.system(size: 12)
}
