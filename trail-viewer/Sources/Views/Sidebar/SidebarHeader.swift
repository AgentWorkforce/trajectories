import SwiftUI
import AppKit

struct SidebarHeader: View {
    let trajectoryCount: Int
    let activeCount: Int
    @EnvironmentObject var appStateStore: AppStateStore

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            HStack {
                Text("Trail Viewer")
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .foregroundColor(Theme.textPrimary)

                Spacer()

                Button(action: openFolderPicker) {
                    Image(systemName: "folder.badge.plus")
                        .font(.system(size: 14))
                        .foregroundColor(Theme.textTertiary)
                }
                .buttonStyle(.plain)
                .help("Open Repository (⌘O)")
            }

            RuleLine()

            HStack {
                if trajectoryCount > 0 {
                    Text("\(trajectoryCount) trajectories · \(activeCount) active")
                        .font(.system(size: 12, weight: .regular, design: .serif))
                        .foregroundColor(Theme.textTertiary)
                }

                Spacer()

                if let path = appStateStore.currentPath {
                    Text(URL(fileURLWithPath: path).lastPathComponent)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Theme.blue)
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, Theme.spacingLG)
        .padding(.vertical, Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sidebarBg)
    }

    private func openFolderPicker() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.message = "Choose a repository with trajectory data"

        if panel.runModal() == .OK, let url = panel.url {
            appStateStore.currentPath = url.path
            appStateStore.addRecentPath(url.path)
        }
    }
}

struct SidebarHeader_Previews: PreviewProvider {
    static var previews: some View {
        SidebarHeader(trajectoryCount: 42, activeCount: 7)
            .environmentObject(AppStateStore())
            .frame(width: 280)
    }
}
