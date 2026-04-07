import SwiftUI
import AppKit

struct WelcomeView: View {
    @EnvironmentObject var appStateStore: AppStateStore

    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            Spacer()

            // 1. Large icon
            Image(systemName: "book.fill")
                .font(.system(size: 64))
                .foregroundColor(Theme.blue)

            // 2. Title
            Text("Trail Viewer")
                .font(Typography.chapterTitle)
                .foregroundColor(Theme.textPrimary)

            // 3. Subtitle
            Text("Read the story of your agent's work")
                .font(Typography.body)
                .foregroundColor(Theme.textSecondary)

            // 4. Ornament divider
            OrnamentDivider()

            // 5. Open Repository button
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

            // 6. Recent paths
            if !appStateStore.recentPaths.isEmpty {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text("RECENT")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                        .textCase(.uppercase)

                    ForEach(appStateStore.recentPaths.prefix(5)) { recent in
                        Button(action: { appStateStore.openRepository(at: recent.path) }) {
                            HStack {
                                Image(systemName: "folder")
                                    .foregroundColor(Theme.textTertiary)
                                Text(recent.path)
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textSecondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Spacer()
                                Text(recent.lastOpened, style: .relative)
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textTertiary)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 2)
                    }
                }
                .frame(maxWidth: 400)
            }

            // 7. Getting started hint
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
            appStateStore.openRepository(at: url.path)
        }
    }
}

struct WelcomeView_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeView()
            .environmentObject(AppStateStore())
    }
}
