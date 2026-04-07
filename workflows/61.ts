import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("61-path-settings-view")
  .description(
    "Create trail-viewer/Sources/Views/Settings/PathSettingsView.swift — trajectory path picker with recent paths",
  )
  .pattern("pipeline")
  .channel("wf-61-path-settings")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI settings designer",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a SwiftUI file: PathSettingsView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Import AppKit (for NSOpenPanel)
- Define struct PathSettingsView: View
- @EnvironmentObject var appStateStore: AppStateStore
- Assume AppStateStore provides:
  - currentPath: String? (current trajectory data path)
  - recentPaths: [RecentPath] (struct with path: String, lastOpened: Date)
  - openRepository(at path: String)
- Layout:
  - VStack(alignment: .leading, spacing: Theme.spacingLG ~20pt):
    1. SectionHeader(title: "Trajectory Path", icon: "folder")
    2. Current path display — BookCard container:
       - VStack(alignment: .leading, spacing: Theme.spacingSM):
         - Text("Current Path") in Typography.body.bold()
         - HStack:
           - If appStateStore.currentPath exists:
             - Text(appStateStore.currentPath!) in .monospaced() Typography.caption, Theme.textSecondary
               - .lineLimit(2)
               - .truncationMode(.middle)
           - Else:
             - Text("No path selected") in Typography.caption, Theme.textTertiary, italic
           - Spacer()
           - Button(action: openFolderPicker):
             - Text("Change...")
             - .font(Typography.caption)
             - .foregroundColor(Theme.blue)
           - .buttonStyle(.plain)
    3. Recent paths — BookCard container:
       - VStack(alignment: .leading, spacing: Theme.spacingSM):
         - Text("Recent Paths") in Typography.body.bold()
         - If appStateStore.recentPaths.isEmpty:
           - Text("No recent paths") in Typography.caption, Theme.textTertiary
         - Else:
           - ForEach(appStateStore.recentPaths) { recent in
               Button(action: { appStateStore.openRepository(at: recent.path) }):
                 HStack:
                   - Image(systemName: "folder") in Theme.textTertiary, 14pt
                   - VStack(alignment: .leading, spacing: 2):
                     - Text(recent.path) in Typography.caption, Theme.textPrimary
                       .lineLimit(1).truncationMode(.middle)
                     - Text("last opened " + formatted relative time) in Typography.caption, Theme.textTertiary
                   - Spacer()
               .buttonStyle(.plain)
               .padding(.vertical, 4)
             }
             - if list has items, each separated by Divider or thin rule
  - .padding(Theme.spacingMD)
- Private func openFolderPicker():
  - NSOpenPanel configured for directory selection
  - canChooseDirectories = true, canChooseFiles = false
  - message = "Choose a folder containing trajectory data"
  - On OK: call appStateStore.openRepository(at: url.path)
- Private func relativeTimeString(from date: Date) -> String:
  - Use RelativeDateTimeFormatter for "2 hours ago" style strings
- Assume Theme, Typography, SectionHeader, BookCard are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/61-path-settings.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/61-path-settings.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/61-path-settings.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Settings/PathSettingsView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Settings/PathSettingsView.swift.
Create the directory trail-viewer/Sources/Views/Settings/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Settings/PathSettingsView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Settings/PathSettingsView.swift && git commit -m "feat: add PathSettingsView — trajectory path picker with recent paths list"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("61-path-settings-view:", result.status);
