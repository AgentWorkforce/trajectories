import SwiftUI

// MARK: - TrajectoryRow

struct TrajectoryRow: View {
    let trajectory: TrajectorySummary
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 0) {
            // Leading blue selection indicator
            if isSelected {
                Rectangle()
                    .fill(Theme.blue)
                    .frame(width: 3)
            }

            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                // Row 1: Task title
                Text(trajectory.title)
                    .font(Typography.heading)
                    .foregroundColor(Theme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                // Row 2: Status, agent count, chapter count
                HStack(spacing: Theme.spacingSM) {
                    StatusBadge(status: trajectory.status.rawValue)

                    Text("\(trajectory.chapterCount ?? 0) chapters")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textSecondary)
                }

                // Row 3: Scrollable tags
                if let tags = trajectory.tags, !tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Theme.spacingXS) {
                            ForEach(tags, id: \.self) { tag in
                                TagPill(tag: tag)
                            }
                        }
                    }
                }

                // Row 4: Relative timestamp
                Text(RelativeTimeFormatter.format(trajectory.startedAt ?? Date()))
                    .font(Typography.caption)
                    .foregroundColor(Theme.textTertiary)
            }
            .padding(.horizontal, Theme.spacingMD)
            .padding(.vertical, Theme.spacingSM)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(isSelected ? Theme.yellowMuted : Color.clear)
        .overlay(alignment: .bottom) {
            RuleLine()
        }
    }
}

// MARK: - Preview

struct TrajectoryRow_Previews: PreviewProvider {
    static var previews: some View {
        let mockTrajectory = TrajectorySummary(
            id: "traj-001",
            title: "Implement authentication flow with OAuth2 and refresh token rotation",
            status: .completed,
            chapterCount: 12,
            decisionCount: 5,
            confidence: 0.9,
            startedAt: Date().addingTimeInterval(-7200),
            completedAt: Date().addingTimeInterval(-3600),
            tags: ["auth", "security", "backend", "oauth"]
        )

        let recentTrajectory = TrajectorySummary(
            id: "traj-002",
            title: "Fix memory leak in WebSocket connection handler",
            status: .active,
            chapterCount: 4,
            decisionCount: 1,
            confidence: nil,
            startedAt: Date().addingTimeInterval(-600),
            completedAt: nil,
            tags: ["bugfix", "networking"]
        )

        VStack(spacing: 0) {
            TrajectoryRow(trajectory: mockTrajectory, isSelected: true)
            TrajectoryRow(trajectory: recentTrajectory, isSelected: false)
        }
        .frame(width: 360)
        .background(Theme.pageBg)
        .previewDisplayName("TrajectoryRow — Selected & Unselected")
    }
}
