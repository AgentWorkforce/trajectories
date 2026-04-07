import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("92-clipboard-service")
  .description(
    "Create trail-viewer/Sources/Services/ClipboardService.swift — macOS clipboard utilities with toast feedback",
  )
  .pattern("pipeline")
  .channel("wf-92-clipboard-service")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift macOS services designer for clipboard operations",
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
    task: `Output the COMPLETE contents of a Swift file: ClipboardService.swift for the Trail Viewer macOS app.

Requirements:
- Import SwiftUI
- Import AppKit (for NSPasteboard)

- Define enum ClipboardService with all static methods (no instances needed)

- static func copyToClipboard(_ text: String):
  - let pasteboard = NSPasteboard.general
  - pasteboard.clearContents()
  - pasteboard.setString(text, forType: .string)

- static func copyTrajectoryAsMarkdown(_ trajectory: TrajectoryViewModel):
  - Build a markdown string from the trajectory view model:
    - "# {trajectory.title}\\n\\n"
    - "**Status:** {trajectory.status}\\n\\n"
    - If has description: "## Description\\n{description}\\n\\n"
    - If has decisions: "## Key Decisions\\n" + each decision as bullet
    - If has retrospective: "## Retrospective\\n{summary}\\n"
  - Call copyToClipboard(markdown)
  - Show toast: ToastManager.shared.show("Trajectory copied as Markdown")

  Note: TrajectoryViewModel should be a protocol or simple struct reference — define a minimal protocol at top of file:
  protocol TrajectoryViewModelProtocol {
    var title: String { get }
    var status: String { get }
    var description: String? { get }
  }
  Or just use a struct TrajectoryClipboardData with those fields.

- static func copyDecision(_ decision: DecisionClipboardData):
  - Define struct DecisionClipboardData: question: String, chosen: String, reasoning: String, alternatives: [String]
  - Build formatted text:
    - "Question: {question}\\n"
    - "Decision: {chosen}\\n"
    - "Reasoning: {reasoning}\\n"
    - "Alternatives: {alternatives.joined(separator: ', ')}\\n"
  - Call copyToClipboard(text)
  - Show toast: ToastManager.shared.show("Decision copied")

- static func copyCodeBlock(_ code: String):
  - Call copyToClipboard(code)
  - Show toast: ToastManager.shared.show("Code copied")

- static func copyURL(_ url: String):
  - Call copyToClipboard(url)
  - Show toast: ToastManager.shared.show("URL copied")

- Define the data structs at the top of the file:
  struct TrajectoryClipboardData { title, status, description?, decisions: [DecisionClipboardData]?, retrospectiveSummary? }
  struct DecisionClipboardData { question, chosen, reasoning, alternatives: [String] }

- Note: ToastManager.shared.show() is assumed to exist from another file.
  If it doesn't exist yet, add a simple placeholder:
  class ToastManager: ObservableObject {
    static let shared = ToastManager()
    @Published var message: String?
    func show(_ text: String) { message = text; DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.message = nil } }
  }

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "ClipboardService" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Services/ClipboardService.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Services/ClipboardService.swift.
Create the directory trail-viewer/Sources/Services/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/ClipboardService.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Services/ClipboardService.swift && git commit -m "feat: add ClipboardService — macOS clipboard utilities with toast feedback"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("92-clipboard-service:", result.status);
