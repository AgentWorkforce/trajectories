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

    private var retrospectiveSummary: String? {
        reflectedString(named: "retrospectiveSummary")
    }

    private var confidenceValue: Double? {
        reflectedDouble(named: "confidence")
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

                    Label("\(summary.agents.count)", systemImage: "person.2.fill")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Theme.textSecondary)

                    Label("\(summary.chapterCount)", systemImage: "book.closed.fill")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Theme.textSecondary)

                    Spacer(minLength: 0)

                    if let confidenceValue {
                        Text("\(Int(clamped(confidenceValue) * 100))%")
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

                if let retrospectiveSummary,
                   !retrospectiveSummary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(retrospectiveSummary)
                        .font(.system(size: 11))
                        .italic()
                        .foregroundColor(Theme.textSecondary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)

                Text(RelativeTimeFormatter.format(summary.updatedAt))
                    .caption()
                    .foregroundColor(Theme.textTertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(width: 280, height: 180, alignment: .topLeading)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }

    private func reflectedString(named key: String) -> String? {
        Mirror(reflecting: summary).children.first(where: { $0.label == key })?.value as? String
    }

    private func reflectedDouble(named key: String) -> Double? {
        Mirror(reflecting: summary).children.first(where: { $0.label == key })?.value as? Double
    }

    private func clamped(_ value: Double) -> Double {
        min(max(value, 0), 1)
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
                eventCount: 18,
                agents: ["Lead", "Worker-1", "Reviewer"],
                tags: ["macos", "preview", "swiftui", "finder"],
                createdAt: Date().addingTimeInterval(-7_200),
                updatedAt: Date().addingTimeInterval(-2_400)
            )
        )
        .padding(24)
        .background(Theme.pageBg)
    }
}
