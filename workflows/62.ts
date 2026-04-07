import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("62-settings-view")
  .description(
    "Create trail-viewer/Sources/Views/Settings/SettingsView.swift — settings sheet container with tabs",
  )
  .pattern("pipeline")
  .channel("wf-62-settings-view")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI settings architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: SettingsView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct SettingsView: View
- @State private var selectedTab: SettingsTab = .aiAssistant
- Define private enum SettingsTab: String, CaseIterable, Identifiable:
  - case aiAssistant = "AI Assistant"
  - case trajectoryPath = "Trajectory Path"
  - case about = "About"
  - var id: String { rawValue }
  - var icon: String (computed: "cpu" for aiAssistant, "folder" for trajectoryPath, "info.circle" for about)
- Layout:
  - HStack(spacing: 0):
    1. Left sidebar — tab list:
       - VStack(alignment: .leading, spacing: 2):
         - ForEach(SettingsTab.allCases) { tab in
             Button(action: { selectedTab = tab }):
               HStack(spacing: Theme.spacingSM):
                 - Image(systemName: tab.icon) .frame(width: 16)
                 - Text(tab.rawValue) in Typography.body
               .padding(.horizontal, Theme.spacingMD)
               .padding(.vertical, Theme.spacingSM)
               .frame(maxWidth: .infinity, alignment: .leading)
               .background(selectedTab == tab ? Theme.blue.opacity(0.1) : Color.clear)
               .foregroundColor(selectedTab == tab ? Theme.blue : Theme.textSecondary)
               .clipShape(RoundedRectangle(cornerRadius: 6))
             .buttonStyle(.plain)
           }
       - .frame(width: 160)
       - .padding(Theme.spacingMD)
       - Right border: Rectangle().fill(Theme.borderLight).frame(width: 0.5)
    2. Right content area:
       - ScrollView:
         - switch selectedTab:
           - case .aiAssistant: CLISettingsView()
           - case .trajectoryPath: PathSettingsView()
           - case .about: AboutSection()
       - .frame(maxWidth: .infinity, maxHeight: .infinity)
  - .frame(minWidth: 500, minHeight: 400)
  - Background: Theme.pageBg

- Define private struct AboutSection: View:
  - VStack(alignment: .leading, spacing: Theme.spacingLG):
    - SectionHeader(title: "About", icon: "info.circle")
    - VStack(alignment: .center, spacing: Theme.spacingSM):
      - Image(systemName: "book.fill").font(.system(size: 40)).foregroundColor(Theme.blue)
      - Text("Trail Viewer") in Typography.heading
      - Text("Version 1.0.0") in Typography.caption, Theme.textTertiary
      - OrnamentDivider()
      - Link("View on GitHub", destination: URL(string: "https://github.com/AgentWorkforce/trail-viewer")!)
        .font(Typography.caption).foregroundColor(Theme.blue)
    .frame(maxWidth: .infinity)
  .padding(Theme.spacingMD)

- Assume Theme, Typography, SectionHeader, OrnamentDivider, CLISettingsView, PathSettingsView are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "SettingsView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Settings/SettingsView.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Settings/SettingsView.swift.
Create the directory trail-viewer/Sources/Views/Settings/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Settings/SettingsView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Settings/SettingsView.swift && git commit -m "feat: add SettingsView — settings sheet with AI Assistant, Path, and About tabs"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("62-settings-view:", result.status);
