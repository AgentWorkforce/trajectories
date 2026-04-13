import SwiftUI

/// Compact preview card for popovers, command palette previews, and drag previews.
struct TrajectoryPreviewCard: View {
    let summary: TrajectorySummary

    private var visibleTags: [String] {
        Array((summary.tags ?? []).prefix(3))
    }

    private var hiddenTagCount: Int {
        max((summary.tags ?? []).count - visibleTags.count, 0)
    }

    var body: some View {
        BookCard {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                Text(summary.title)
                    .heading()
                    .lineLimit(2)
                    .truncationMode(.tail)

                HStack(spacing: Theme.spacingSM) {
                    StatusBadge(status: summary.status.rawValue)

                    Label("\(summary.chapterCount ?? 0)", systemImage: "book.closed.fill")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Theme.textSecondary)

                    Spacer(minLength: 0)

                    if let confidence = summary.confidence {
                        Text("\(Int(min(max(confidence, 0), 1) * 100))%")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Theme.blue)
                    }
                }

                if !visibleTags.isEmpty {
                    HStack(spacing: Theme.spacingXS) {
                        ForEach(visibleTags, id: \.self) { tag in
                            TagPill(tag: tag)
                        }

                        if hiddenTagCount > 0 {
                            Text("+\(hiddenTagCount) more")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Theme.textTertiary)
                        }

                        Spacer(minLength: 0)
                    }
                }

                Spacer(minLength: 0)

                Text(RelativeTimeFormatter.format(summary.startedAt ?? Date()))
                    .caption()
                    .foregroundColor(Theme.textTertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 280, height: 180, alignment: .topLeading)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }
}

struct TrajectoryPreviewCard_Previews: PreviewProvider {
    static var previews: some View {
        TrajectoryPreviewCard(
            summary: TrajectorySummary(
                id: "traj_preview_001",
                title: "Implement Quick Look preview generation for trajectory files",
                status: .completed,
                chapterCount: 4,
                decisionCount: 3,
                confidence: 0.85,
                startedAt: Date().addingTimeInterval(-7_200),
                completedAt: Date().addingTimeInterval(-2_400),
                tags: ["macos", "preview", "swiftui", "finder"]
            )
        )
        .padding(24)
        .background(Theme.pageBg)
    }
}
