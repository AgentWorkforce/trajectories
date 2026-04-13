import SwiftUI

struct StatusBar: View {
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @EnvironmentObject var appStateStore: AppStateStore

    /// Connection state from the relay (passed in or environment).
    var serverState: ServerState = .stopped

    var body: some View {
        HStack {
            HStack(spacing: Theme.spacingXS) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 6, height: 6)

                Text(statusText)
                    .font(.system(size: 11))
                    .foregroundColor(Theme.textTertiary)
            }

            Spacer()

            Text(countLabel)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Theme.textSecondary)

            Spacer()

            Text("⌘K Search  ·  ⌘⇧C Chat")
                .font(.system(size: 11))
                .foregroundColor(Theme.textTertiary)
        }
        .padding(.horizontal, Theme.spacingBase)
        .frame(height: LayoutConstants.statusBarHeight)
        .background(Theme.sidebarBg)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.border)
                .frame(height: 0.5)
        }
    }

    private var dotColor: Color {
        switch serverState {
        case .running:
            return Theme.statusActive
        case .starting:
            return Theme.yellow
        case .error:
            return Theme.error
        case .stopped:
            return Theme.textTertiary
        }
    }

    private var statusText: String {
        switch serverState {
        case .running:
            return "Connected"
        case .starting:
            return "Connecting…"
        case .error:
            return "Error"
        case .stopped:
            return "Offline"
        }
    }

    private var countLabel: String {
        let total = trajectoryStore.stats.total
        let filtered = trajectoryStore.filteredTrajectories.count
        if filtered == total {
            return "\(total) trajectories"
        }
        return "\(filtered) of \(total) trajectories"
    }
}
