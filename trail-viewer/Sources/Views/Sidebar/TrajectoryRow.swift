import SwiftUI

// MARK: - Relative Time Formatter

private struct RelativeTimeFormatter {
    static func string(from date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)

        guard interval > 0 else { return "just now" }

        let minutes = Int(interval / 60)
        let hours = Int(interval / 3600)
        let days = Int(interval / 86400)
        let weeks = Int(interval / 604800)

        if minutes < 1 {
            return "just now"
        } else if minutes < 60 {
            return "\(minutes)m ago"
        } else if hours < 24 {
            return "\(hours)h ago"
        } else if days < 7 {
            return "\(days)d ago"
        } else if weeks < 4 {
            return "\(weeks)w ago"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }
}

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
                Text(trajectory.task)
                    .font(Typography.heading)
                    .foregroundColor(Theme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                // Row 2: Status, agent count, chapter count
                HStack(spacing: Theme.spacingSM) {
                    StatusBadge(status: trajectory.status)

                    Text("\(trajectory.agentCount) agents")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textSecondary)

                    Text("\(trajectory.chapterCount) chapters")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textSecondary)
                }

                // Row 3: Scrollable tags
                if !trajectory.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Theme.spacingXS) {
                            ForEach(trajectory.tags, id: \.self) { tag in
                                TagPill(tag: tag)
                            }
                        }
                    }
                }

                // Row 4: Relative timestamp
                Text(RelativeTimeFormatter.string(from: trajectory.updatedAt))
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
            task: "Implement authentication flow with OAuth2 and refresh token rotation",
            status: .complete,
            agentCount: 3,
            chapterCount: 12,
            tags: ["auth", "security", "backend", "oauth"],
            updatedAt: Date().addingTimeInterval(-3600) // 1 hour ago
        )

        let recentTrajectory = TrajectorySummary(
            id: "traj-002",
            task: "Fix memory leak in WebSocket connection handler",
            status: .running,
            agentCount: 1,
            chapterCount: 4,
            tags: ["bugfix", "networking"],
            updatedAt: Date().addingTimeInterval(-120) // 2 minutes ago
        )

        VStack(spacing: 0) {
            TrajectoryRow(trajectory: mockTrajectory, isSelected: true)
            TrajectoryRow(trajectory: recentTrajectory, isSelected: false)
        }
        .frame(width: 360)
        .background(Theme.backgroundPrimary)
        .previewDisplayName("TrajectoryRow — Selected & Unselected")
    }
}
