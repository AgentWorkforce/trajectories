import SwiftUI

// MARK: - TrajectoryHeaderView

struct TrajectoryHeaderView: View {
    let trajectory: Trajectory

    // MARK: - Date Formatting

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private var dateRangeText: String {
        guard let startedAt = trajectory.startedAt else {
            return "No start date"
        }
        let started = "Started \(Self.dateFormatter.string(from: startedAt))"
        if let completed = trajectory.completedAt {
            return "\(started) — Completed \(Self.dateFormatter.string(from: completed))"
        }
        return started
    }

    private var agentNames: String {
        guard let agents = trajectory.agents, !agents.isEmpty else { return "" }
        return agents.map(\.displayName).joined(separator: ", ")
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            Text(trajectory.title)
                .chapterTitle()

            if let description = trajectory.description {
                Text(description)
                    .bodyStyle()
            }

            HStack(spacing: Theme.spacingMD) {
                StatusBadge(status: trajectory.status.rawValue)

                if !agentNames.isEmpty {
                    Text(agentNames)
                        .caption()
                }

                Spacer()

                Text(dateRangeText)
                    .caption()
            }

            if let tags = trajectory.tags, !tags.isEmpty {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(tags, id: \.self) { tag in
                        TagPill(tag: tag)
                    }
                }
            }

            Rectangle()
                .fill(Theme.borderLight)
                .frame(maxWidth: .infinity)
                .frame(height: 2)
        }
        .padding(.horizontal, Theme.spacingXXL)
        .padding(.vertical, Theme.spacingLG)
    }
}

// MARK: - Preview

#if false // Disabled: #Preview requires Xcode
#Preview("TrajectoryHeaderView") {
    let mockTrajectory = Trajectory(
        id: "traj-001",
        version: nil,
        task: TrajectoryTask(title: "Implement User Authentication Flow", description: "Build the complete authentication system including login, signup, password reset, and session management with OAuth2 support."),
        status: .completed,
        startedAt: Date().addingTimeInterval(-7200),
        completedAt: Date().addingTimeInterval(-600),
        agents: [
            AgentParticipation(
                name: "Lead",
                agentName: nil,
                role: "lead",
                joinedAt: Date().addingTimeInterval(-7200),
                leftAt: nil
            ),
            AgentParticipation(
                name: "Worker-1",
                agentName: nil,
                role: "worker",
                joinedAt: Date().addingTimeInterval(-6000),
                leftAt: Date().addingTimeInterval(-1800)
            ),
        ],
        chapters: [],
        retrospective: nil,
        commits: nil,
        filesChanged: nil,
        projectId: nil,
        tags: ["auth", "security", "oauth2"]
    )

    ScrollView {
        TrajectoryHeaderView(trajectory: mockTrajectory)
    }
    .frame(width: 700, height: 400)
    .background(Theme.pageBg)
}

#Preview("TrajectoryHeaderView — Active, No Source") {
    let mockTrajectory = Trajectory(
        id: "traj-002",
        version: nil,
        task: TrajectoryTask(title: "Refactor Data Pipeline for Real-Time Processing", description: nil),
        status: .active,
        startedAt: Date().addingTimeInterval(-3600),
        completedAt: nil,
        agents: [
            AgentParticipation(
                name: "Analyst",
                agentName: nil,
                role: "analyst",
                joinedAt: Date().addingTimeInterval(-3600),
                leftAt: nil
            ),
        ],
        chapters: [],
        retrospective: nil,
        commits: nil,
        filesChanged: nil,
        projectId: nil,
        tags: ["refactor", "pipeline"]
    )

    ScrollView {
        TrajectoryHeaderView(trajectory: mockTrajectory)
    }
    .frame(width: 700, height: 300)
    .background(Theme.pageBg)
}
#endif
