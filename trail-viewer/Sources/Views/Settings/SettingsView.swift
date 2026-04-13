import SwiftUI

struct SettingsView: View {
    @State private var selectedTab: SettingsTab = .aiAssistant

    private enum SettingsTab: String, CaseIterable, Identifiable {
        case aiAssistant = "AI Assistant"
        case trajectoryPath = "Trajectory Path"
        case about = "About"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .aiAssistant: return "cpu"
            case .trajectoryPath: return "folder"
            case .about: return "info.circle"
            }
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left sidebar — tab list
            VStack(alignment: .leading, spacing: 2) {
                ForEach(SettingsTab.allCases) { tab in
                    Button(action: { selectedTab = tab }) {
                        HStack(spacing: Theme.spacingSM) {
                            Image(systemName: tab.icon)
                                .frame(width: 16)
                            Text(tab.rawValue)
                                .font(Typography.body)
                        }
                        .padding(.horizontal, Theme.spacingMD)
                        .padding(.vertical, Theme.spacingSM)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(selectedTab == tab ? Theme.blue.opacity(0.1) : Color.clear)
                        .foregroundColor(selectedTab == tab ? Theme.blue : Theme.textSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(width: 160)
            .padding(Theme.spacingMD)

            // Right border
            Rectangle()
                .fill(Theme.borderLight)
                .frame(width: 0.5)

            // Right content area
            ScrollView {
                switch selectedTab {
                case .aiAssistant:
                    CLISettingsView()
                case .trajectoryPath:
                    PathSettingsView()
                case .about:
                    AboutSection()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(minWidth: 500, minHeight: 400)
        .background(Theme.pageBg)
    }
}

private struct AboutSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingLG) {
            SectionHeader(title: "About", icon: "info.circle")

            VStack(alignment: .center, spacing: Theme.spacingSM) {
                Image(systemName: "book.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Theme.blue)

                Text("Trail Viewer")
                    .font(Typography.heading)

                Text("Version 1.0.0")
                    .font(Typography.caption)
                    .foregroundColor(Theme.textTertiary)

                OrnamentDivider()

                Link("View on GitHub", destination: URL(string: "https://github.com/AgentWorkforce/trail-viewer")!)
                    .font(Typography.caption)
                    .foregroundColor(Theme.blue)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(Theme.spacingMD)
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
    }
}
