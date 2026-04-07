import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("89-help-tooltips")
  .description(
    "Create trail-viewer/Sources/Design/HelpTooltips.swift — ViewModifier for accessible help tooltips",
  )
  .pattern("pipeline")
  .channel("wf-89-help-tooltips")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI accessibility designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: HelpTooltips.swift for the Trail Viewer macOS app.

Requirements:
- Import SwiftUI

- Define a ViewModifier: HelpTooltipModifier
  - Property: text: String
  - body function: apply .help(text) to the content view
  - This is a simple wrapper that standardizes tooltip usage

- Extension on View:
  - func helpTooltip(_ text: String) -> some View
    - Returns self.modifier(HelpTooltipModifier(text: text))

- Define struct HelpTooltips (namespace for predefined tooltip strings):
  - static let toggleSidebar = "Show/Hide Sidebar (\\u{2318}0)"
  - static let toggleChat = "Toggle Chat (\\u{2318}\\u{21E7}C)"
  - static let commandPalette = "Search (\\u{2318}K)"
  - static let refreshTrajectories = "Refresh (\\u{2318}R)"
  - static let exportMarkdown = "Export as Markdown"
  - static let exportTimeline = "Export Timeline"
  - static let exportJSON = "Export as JSON"
  - static let copyToClipboard = "Copy to Clipboard"
  - static let filterByStatus = "Filter by Status"
  - static let searchTrajectories = "Search Trajectories"
  - static let selectPersona = "Select Chat Persona"
  - static let sendMessage = "Send Message (Return)"
  - static let stopSession = "Stop Chat Session"

- Add a PreviewProvider showing a few buttons with tooltips applied:
  - Button with toggleSidebar tooltip
  - Button with commandPalette tooltip
  - Button with refreshTrajectories tooltip

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/89-help-tooltips.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/89-help-tooltips.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/89-help-tooltips.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Design/HelpTooltips.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Design/HelpTooltips.swift.
Create the directory trail-viewer/Sources/Design/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/HelpTooltips.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/HelpTooltips.swift && git commit -m "feat: add HelpTooltips — accessible tooltip modifiers for interactive elements"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("89-help-tooltips:", result.status);
