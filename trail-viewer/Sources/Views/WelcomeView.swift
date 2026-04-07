import SwiftUI
import AppKit

struct WelcomeView: View {
    @EnvironmentObject var appStateStore: AppStateStore

    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            Spacer()

            Image(systemName: "book.fill")
                .font(.system(size: 64))
                .foregroundColor(Theme.blue)

            Text("Trail Viewer")
                .font(Typography.chapterTitle)
                .foregroundColor(Theme.textPrimary)

            Text("Read the story of your agent's work")
                .font(Typography.body)
                .foregroundColor(Theme.textSecondary)

            OrnamentDivider()

            Button(action: openFolderPicker) {
                HStack {
                    Image(systemName: "folder.badge.plus")
                    Text("Open Repository")
                }
                .font(Typography.body.bold())
                .foregroundColor(.white)
                .padding(.horizontal, Theme.spacingXL)
                .padding(.vertical, Theme.spacingMD)
                .background(Theme.blue)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)

            if !appStateStore.recentPaths.isEmpty {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text("RECENT")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                        .textCase(.uppercase)

                    ForEach(appStateStore.recentPaths.prefix(5), id: \.self) { path in
                        Button(action: {
                            appStateStore.currentPath = path
                        }) {
                            HStack {
                                Image(systemName: "folder")
                                    .foregroundColor(Theme.textTertiary)
                                Text(path)
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textSecondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 2)
                    }
                }
                .frame(maxWidth: 400)
            }

            Text("Point to a repository with .trajectories/ data to get started")
                .font(Typography.caption)
                .foregroundColor(Theme.textTertiary)
                .padding(.top, Theme.spacingMD)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageBg)
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

struct WelcomeView_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeView()
            .environmentObject(AppStateStore())
    }
}
