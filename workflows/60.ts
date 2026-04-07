import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("60-cli-settings-view")
  .description(
    "Create trail-viewer/Sources/Views/Settings/CLISettingsView.swift — AI assistant CLI detection and picker",
  )
  .pattern("pipeline")
  .channel("wf-60-cli-settings")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI settings panel designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: CLISettingsView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct CLISettingsView: View
- @EnvironmentObject var cliSettingsStore: CLISettingsStore
- Assume CLISettingsStore provides:
  - preferredCLI: String? (nil = automatic)
  - detectedCLIs: [CLIInfo] (struct with id: String, name: String, version: String?, path: String?, isInstalled: Bool, supportsChat: Bool)
  - autoDetectedCLI: CLIInfo? (the auto-detected best CLI)
  - setPreferredCLI(_ id: String?)
  - refreshDetection() async
  - isRefreshing: Bool
- Layout:
  - VStack(alignment: .leading, spacing: Theme.spacingLG ~20pt):
    1. SectionHeader(title: "AI Assistant", icon: "cpu")
    2. Preferred CLI picker — BookCard container:
       - VStack(alignment: .leading, spacing: Theme.spacingMD):
         - Text("Preferred CLI") in Typography.body.bold()
         - Button for "Automatic" option:
           - HStack:
             - Image(systemName: cliSettingsStore.preferredCLI == nil ? "checkmark.circle.fill" : "circle")
               .foregroundColor(cliSettingsStore.preferredCLI == nil ? Theme.blue : Theme.textTertiary)
             - VStack(alignment: .leading):
               - Text("Automatic") in Typography.body
               - If autoDetectedCLI: Text("Currently using \\(autoDetectedCLI.name)") in Typography.caption, Theme.textTertiary
           - .buttonStyle(.plain)
           - .onTapGesture { cliSettingsStore.setPreferredCLI(nil) }
         - ForEach detected CLIs that are installed:
           - Button row with checkmark/circle, name, version, path
           - Selected when preferredCLI == cli.id
           - .onTapGesture { cliSettingsStore.setPreferredCLI(cli.id) }
    3. Status grid — BookCard container:
       - VStack(alignment: .leading, spacing: Theme.spacingSM):
         - Text("Detected CLIs") in Typography.body.bold()
         - ForEach all detectedCLIs:
           - HStack:
             - Circle().fill(cli.isInstalled ? Color.green : Color.red).frame(width: 8, height: 8)
             - Text(cli.name) in Typography.body
             - Spacer()
             - If cli.isInstalled: Text(cli.version ?? "unknown") in Typography.caption, Theme.textTertiary
             - Else: Text("not installed") in Typography.caption, Theme.textTertiary
             - If cli.supportsChat: Text("Supported for chat").font(Typography.caption).foregroundColor(Theme.blue).padding(.horizontal, 6).padding(.vertical, 2).background(Theme.blue.opacity(0.1)).clipShape(Capsule())
    4. Refresh button:
       - Button(action: { Task { await cliSettingsStore.refreshDetection() } }):
         - HStack:
           - If cliSettingsStore.isRefreshing: ProgressView().scaleEffect(0.7)
           - Else: Image(systemName: "arrow.clockwise")
           - Text("Refresh Detection")
         - .foregroundColor(Theme.blue)
       - .buttonStyle(.plain)
       - .disabled(cliSettingsStore.isRefreshing)
  - .padding(Theme.spacingMD)
- Assume Theme, Typography, SectionHeader, BookCard are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/60-cli-settings.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/60-cli-settings.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/60-cli-settings.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Settings/CLISettingsView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Settings/CLISettingsView.swift.
Create the directory trail-viewer/Sources/Views/Settings/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Settings/CLISettingsView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Settings/CLISettingsView.swift && git commit -m "feat: add CLISettingsView — AI assistant CLI picker with detection status"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("60-cli-settings-view:", result.status);
