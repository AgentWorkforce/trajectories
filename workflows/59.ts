import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("59-welcome-view")
  .description(
    "Create trail-viewer/Sources/Views/WelcomeView.swift — first-launch welcome screen with open repository",
  )
  .pattern("pipeline")
  .channel("wf-59-welcome-view")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI welcome screen designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: WelcomeView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Import AppKit (for NSOpenPanel)
- Define struct WelcomeView: View
- @EnvironmentObject var appStateStore: AppStateStore
- Assume AppStateStore provides:
  - recentPaths: [RecentPath] (struct with path: String, lastOpened: Date)
  - openRepository(at path: String)
  - currentPath: String?
- Layout:
  - VStack(spacing: Theme.spacingLG ~20pt) centered:
    1. Large icon:
       - Image(systemName: "book.fill")
       - .font(.system(size: 64))
       - .foregroundColor(Theme.blue) — pastel blue #7eb8da
    2. Title:
       - Text("Trail Viewer") in Typography.chapterTitle (serif, large, ~28pt)
       - .foregroundColor(Theme.textPrimary)
    3. Subtitle:
       - Text("Read the story of your agent's work") in Typography.body
       - .foregroundColor(Theme.textSecondary)
    4. OrnamentDivider() — decorative divider from Design/
    5. "Open Repository" button:
       - Button(action: openFolderPicker):
         - HStack:
           - Image(systemName: "folder.badge.plus")
           - Text("Open Repository")
         - .font(Typography.body.bold())
         - .foregroundColor(.white)
         - .padding(.horizontal, Theme.spacingXL ~24pt)
         - .padding(.vertical, Theme.spacingMD ~12pt)
         - .background(Theme.blue)
         - .clipShape(RoundedRectangle(cornerRadius: 8))
       - .buttonStyle(.plain)
    6. If appStateStore.recentPaths is not empty:
       - VStack(alignment: .leading, spacing: Theme.spacingSM):
         - Text("Recent") in Typography.caption, Theme.textTertiary, uppercased
         - ForEach(appStateStore.recentPaths.prefix(5)) { recent in
             Button(action: { appStateStore.openRepository(at: recent.path) }):
               HStack:
                 - Image(systemName: "folder") in Theme.textTertiary
                 - Text(recent.path) in Typography.caption, Theme.textSecondary, .lineLimit(1), .truncationMode(.middle)
                 - Spacer()
                 - Text(relative time like "2h ago") in Typography.caption, Theme.textTertiary
             .buttonStyle(.plain)
             .padding(.vertical, 2)
           }
         - .frame(maxWidth: 400)
    7. Getting started hint:
       - Text("Point to a repository with .trajectories/ data to get started")
       - .font(Typography.caption)
       - .foregroundColor(Theme.textTertiary)
       - .padding(.top, Theme.spacingMD)
  - .frame(maxWidth: .infinity, maxHeight: .infinity)
  - Background: Theme.pageBg (#faf8f5)
  - Private func openFolderPicker():
    - Create NSOpenPanel()
    - panel.canChooseDirectories = true
    - panel.canChooseFiles = false
    - panel.allowsMultipleSelection = false
    - panel.message = "Choose a repository with trajectory data"
    - If panel.runModal() == .OK, get URL and call appStateStore.openRepository(at: url.path)
- Assume Theme, Typography, OrnamentDivider are available from Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "WelcomeView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/WelcomeView.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/WelcomeView.swift.
Create the directory trail-viewer/Sources/Views/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/WelcomeView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/WelcomeView.swift && git commit -m "feat: add WelcomeView — first-launch screen with book icon and open repository"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("59-welcome-view:", result.status);
