# TrajectoryHeaderView.swift

## Complete SwiftUI File

```swift
import SwiftUI

// MARK: - TrajectoryHeaderView

struct TrajectoryHeaderView: View {
    let trajectory: Trajectory

    // MARK: - Date Formatting

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    private var dateRangeText: String {
        let started = "Started \(Self.dateFormatter.string(from: trajectory.createdAt))"
        if let completed = trajectory.completedAt {
            return "\(started) — Completed \(Self.dateFormatter.string(from: completed))"
        }
        return started
    }

    private var agentNames: String {
        guard let agents = trajectory.agents, !agents.isEmpty else { return "" }
        return agents.map(\.agentName).joined(separator: ", ")
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            // 1. Title
            Text(trajectory.title)
                .chapterTitle()

            // 2. Description
            if let description = trajectory.description {
                Text(description)
                    .bodyStyle()
            }

            // 3. Metadata row
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

            // 4. Tags row
            if let tags = trajectory.tags, !tags.isEmpty {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(tags, id: \.self) { tag in
                        TagPill(tag: tag)
                    }
                }
            }

            // 5. Source link
            if let taskRef = trajectory.taskReference, let urlString = taskRef.source.url,
               let url = URL(string: urlString) {
                Link(destination: url) {
                    HStack(spacing: 4) {
                        Image(systemName: "link.circle")
                            .font(.system(size: 12))
                        Text(taskRef.source.title ?? urlString)
                            .caption()
                    }
                    .foregroundColor(Theme.blue)
                }
            }

            // 6. Bottom rule line (thick, 2pt)
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

#Preview("TrajectoryHeaderView") {
    let mockTrajectory = Trajectory(
        id: "traj-001",
        title: "Implement User Authentication Flow",
        description: "Build the complete authentication system including login, signup, password reset, and session management with OAuth2 support.",
        status: .completed,
        taskReference: TaskReference(
            source: TaskSource(
                system: .github,
                identifier: "anthropics/agent-workforce#42",
                url: "https://github.com/anthropics/agent-workforce/issues/42",
                title: "anthropics/agent-workforce#42"
            ),
            description: "Auth flow implementation"
        ),
        chapters: [],
        decisions: nil,
        retrospective: nil,
        agents: [
            AgentParticipation(
                agentName: "Lead",
                role: .lead,
                joinedAt: Date().addingTimeInterval(-7200),
                leftAt: nil,
                eventsCount: 45
            ),
            AgentParticipation(
                agentName: "Worker-1",
                role: .worker,
                joinedAt: Date().addingTimeInterval(-6000),
                leftAt: Date().addingTimeInterval(-1800),
                eventsCount: 32
            )
        ],
        tags: ["auth", "security", "oauth2"],
        createdAt: Date().addingTimeInterval(-7200),
        updatedAt: Date(),
        completedAt: Date().addingTimeInterval(-600),
        filesChanged: nil,
        commits: nil
    )

    ScrollView {
        TrajectoryHeaderView(trajectory: mockTrajectory)
    }
    .frame(width: 700, height: 400)
    .background(Theme.page)
}

#Preview("TrajectoryHeaderView — Active, No Source") {
    let mockTrajectory = Trajectory(
        id: "traj-002",
        title: "Refactor Data Pipeline for Real-Time Processing",
        description: nil,
        status: .active,
        taskReference: nil,
        chapters: [],
        decisions: nil,
        retrospective: nil,
        agents: [
            AgentParticipation(
                agentName: "Analyst",
                role: .analyst,
                joinedAt: Date().addingTimeInterval(-3600),
                leftAt: nil,
                eventsCount: 12
            )
        ],
        tags: ["refactor", "pipeline"],
        createdAt: Date().addingTimeInterval(-3600),
        updatedAt: Date(),
        completedAt: nil,
        filesChanged: nil,
        commits: nil
    )

    ScrollView {
        TrajectoryHeaderView(trajectory: mockTrajectory)
    }
    .frame(width: 700, height: 300)
    .background(Theme.page)
}
```

## Design Notes

- Uses the **actual Trajectory model** from `TrajectoryModels.swift` (not the simplified version from the spec prompt). Key differences: field is `title` not `task`, agents are `[AgentParticipation]` not `[AgentInfo]`, source is `TaskReference?` not `String?`, date is `createdAt` not `startedAt`.
- Typography: `.chapterTitle()` for the title (26pt serif bold), `.bodyStyle()` for description, `.caption()` for metadata.
- Components: `StatusBadge`, `TagPill` from `Badges.swift`; thick 2pt `Rectangle` for bottom rule (standard `RuleLine` is 0.5pt).
- Spacing: `Theme.spacingXXL` horizontal padding (~56pt), `Theme.spacingLG` vertical (~20pt), `Theme.spacingMD` internal (~12pt).
- Light mode / book aesthetic: uses `Theme.page` background, serif title, muted secondary colors.
- Source link uses `Link` for native macOS URL opening with `link.circle` SF Symbol.
- Two preview variants: completed trajectory with all fields, and active trajectory with minimal fields.
