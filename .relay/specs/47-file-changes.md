# FileChangesView.swift — Complete Implementation

```swift
import SwiftUI

struct FileChangesView: View {
    let files: [String]
    let commits: [CommitInfo]

    @State private var showFiles: Bool = false
    @State private var showCommits: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingMD) {
            RuleLine()

            // MARK: - Files Section
            Button(action: {
                withAnimation(.easeInOut(duration: 0.25)) {
                    showFiles.toggle()
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Theme.textTertiary)

                    Text("Files Changed (\(files.count))")
                        .font(Typography.sectionTitle)
                        .foregroundColor(Theme.textPrimary)

                    Spacer()

                    Image(systemName: showFiles ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Theme.textTertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showFiles {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(files, id: \.self) { file in
                        Text(file)
                            .font(Typography.code)
                            .foregroundColor(Theme.textSecondary)
                            .padding(.leading, 20)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            // MARK: - Commits Section
            Button(action: {
                withAnimation(.easeInOut(duration: 0.25)) {
                    showCommits.toggle()
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 14))
                        .foregroundColor(Theme.textTertiary)

                    Text("Commits (\(commits.count))")
                        .font(Typography.sectionTitle)
                        .foregroundColor(Theme.textPrimary)

                    Spacer()

                    Image(systemName: showCommits ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Theme.textTertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showCommits {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(commits, id: \.hash) { commit in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(String(commit.hash.prefix(7)))
                                .font(Typography.code)
                                .foregroundColor(Theme.blue)

                            Text(commit.message)
                                .font(Typography.caption)
                                .foregroundColor(Theme.textSecondary)
                                .lineLimit(1)
                        }
                        .padding(.leading, 20)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, Theme.spacingLG)
    }
}

struct FileChangesView_Previews: PreviewProvider {
    static var previews: some View {
        FileChangesView(
            files: [
                "Sources/TrailViewer/Views/TimelineView.swift",
                "Sources/TrailViewer/Models/TrajectoryData.swift",
                "Sources/TrailViewer/Design/Theme.swift",
                "Tests/TrailViewerTests/TimelineTests.swift"
            ],
            commits: [
                CommitInfo(hash: "a1b2c3d4e5f6789", message: "feat: add timeline scrubbing controls"),
                CommitInfo(hash: "f9e8d7c6b5a4321", message: "fix: correct date formatting in chapter headers"),
                CommitInfo(hash: "1234567890abcdef", message: "refactor: extract theme constants to Design folder")
            ]
        )
        .padding(Theme.spacingXL)
        .frame(width: 500)
        .background(Theme.backgroundPrimary)
    }
}
```
