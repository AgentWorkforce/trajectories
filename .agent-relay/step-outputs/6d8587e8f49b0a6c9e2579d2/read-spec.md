# PathSettingsView.swift — Complete Implementation

```swift
import SwiftUI
import AppKit

struct PathSettingsView: View {
    @EnvironmentObject var appStateStore: AppStateStore

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingLG) {
            SectionHeader(title: "Trajectory Path", icon: "folder")

            // MARK: - Current Path
            BookCard {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text("Current Path")
                        .font(Typography.body.bold())
                        .foregroundColor(Theme.textPrimary)

                    HStack {
                        if let currentPath = appStateStore.currentPath {
                            Text(currentPath)
                                .font(Typography.caption.monospaced())
                                .foregroundColor(Theme.textSecondary)
                                .lineLimit(2)
                                .truncationMode(.middle)
                        } else {
                            Text("No path selected")
                                .font(Typography.caption)
                                .foregroundColor(Theme.textTertiary)
                                .italic()
                        }

                        Spacer()

                        Button(action: openFolderPicker) {
                            Text("Change...")
                                .font(Typography.caption)
                                .foregroundColor(Theme.blue)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // MARK: - Recent Paths
            BookCard {
                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text("Recent Paths")
                        .font(Typography.body.bold())
                        .foregroundColor(Theme.textPrimary)

                    if appStateStore.recentPaths.isEmpty {
                        Text("No recent paths")
                            .font(Typography.caption)
                            .foregroundColor(Theme.textTertiary)
                    } else {
                        ForEach(Array(appStateStore.recentPaths.enumerated()), id: \.element.path) { index, recent in
                            if index > 0 {
                                Divider()
                                    .background(Theme.borderLight)
                            }

                            Button(action: {
                                appStateStore.openRepository(at: recent.path)
                            }) {
                                HStack {
                                    Image(systemName: "folder")
                                        .foregroundColor(Theme.textTertiary)
                                        .font(.system(size: 14))

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(recent.path)
                                            .font(Typography.caption)
                                            .foregroundColor(Theme.textPrimary)
                                            .lineLimit(1)
                                            .truncationMode(.middle)

                                        Text("last opened \(relativeTimeString(from: recent.lastOpened))")
                                            .font(Typography.caption)
                                            .foregroundColor(Theme.textTertiary)
                                    }

                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
        }
        .padding(Theme.spacingMD)
    }

    // MARK: - Folder Picker

    private func openFolderPicker() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.message = "Choose a folder containing trajectory data"

        if panel.runModal() == .OK, let url = panel.url {
            appStateStore.openRepository(at: url.path)
        }
    }

    // MARK: - Relative Time Formatting

    private func relativeTimeString(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Preview

struct PathSettingsView_Previews: PreviewProvider {
    static var previews: some View {
        PathSettingsView()
            .environmentObject(AppStateStore())
            .frame(width: 500, height: 400)
    }
}
```
