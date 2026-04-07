import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("67-export-sheet")
  .description(
    "Create trail-viewer/Sources/Views/ExportSheet.swift — export trajectory as Markdown, JSON, or Timeline",
  )
  .pattern("pipeline")
  .channel("wf-67-export-sheet")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI export UI designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: ExportSheet.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Import AppKit (for NSSavePanel and NSPasteboard)
- Define struct ExportSheet: View
- Properties:
  - trajectory: Trajectory
  - @Binding var isPresented: Bool
- @State private var selectedFormat: ExportFormat = .markdown
- Define enum ExportFormat: String, CaseIterable, Identifiable:
  - case markdown = "Markdown"
  - case json = "JSON"
  - case timeline = "Timeline"
  - var id: String { rawValue }
  - var icon: String { "doc.text" for markdown, "curlybraces" for json, "clock" for timeline }
  - var fileExtension: String { "md", "json", "txt" }
- Layout:
  - VStack(spacing: 0):
    1. Header:
       - HStack:
         - Text("Export Trajectory") in Typography.heading (serif)
         - Spacer()
         - Button(action: { isPresented = false }):
           - Image(systemName: "xmark.circle.fill") in Theme.textTertiary
         - .buttonStyle(.plain)
       - .padding(Theme.spacingMD)
       - RuleLine()
    2. Format picker:
       - HStack(spacing: Theme.spacingSM):
         - ForEach(ExportFormat.allCases) { format in
             Button(action: { selectedFormat = format }):
               HStack(spacing: 4):
                 - Image(systemName: format.icon)
                 - Text(format.rawValue)
               .font(Typography.caption)
               .padding(.horizontal, Theme.spacingMD)
               .padding(.vertical, 6)
               .background(selectedFormat == format ? Theme.blue : Theme.cardBg)
               .foregroundColor(selectedFormat == format ? .white : Theme.textSecondary)
               .clipShape(RoundedRectangle(cornerRadius: 6))
             .buttonStyle(.plain)
           }
       - .padding(Theme.spacingMD)
    3. Preview area — BookCard:
       - ScrollView:
         - Text(exportContent)
           .font(selectedFormat == .json ? .system(.body, design: .monospaced) : Typography.body)
           .foregroundColor(Theme.textPrimary)
           .textSelection(.enabled)
           .frame(maxWidth: .infinity, alignment: .leading)
       - .frame(maxHeight: 300)
       - .padding(Theme.spacingMD)
    4. Action buttons:
       - HStack:
         - Button(action: copyToClipboard):
           - HStack:
             - Image(systemName: "doc.on.doc")
             - Text("Copy to Clipboard")
           - .font(Typography.body)
           - .foregroundColor(Theme.blue)
         - .buttonStyle(.plain)
         - Spacer()
         - Button(action: saveToFile):
           - HStack:
             - Image(systemName: "square.and.arrow.down")
             - Text("Save to File...")
           - .font(Typography.body.bold())
           - .foregroundColor(.white)
           - .padding(.horizontal, Theme.spacingLG)
           - .padding(.vertical, Theme.spacingSM)
           - .background(Theme.blue)
           - .clipShape(RoundedRectangle(cornerRadius: 8))
         - .buttonStyle(.plain)
       - .padding(Theme.spacingMD)
  - .frame(width: 550, minHeight: 450)
  - Background: Theme.pageBg

- Computed property exportContent: String:
  - switch selectedFormat:
    - .markdown: generate markdown with # title, description, chapters, retrospective
    - .json: use JSONEncoder with .prettyPrinted to encode trajectory
    - .timeline: generate text timeline with timestamps and events

- Private func copyToClipboard():
  - NSPasteboard.general.clearContents()
  - NSPasteboard.general.setString(exportContent, forType: .string)

- Private func saveToFile():
  - NSSavePanel()
  - panel.allowedContentTypes based on format (UTType.plainText for md/txt, UTType.json for json)
  - panel.nameFieldStringValue = "\\(trajectory.id).\\(selectedFormat.fileExtension)"
  - On OK: write exportContent to file

- Assume Theme, Typography, BookCard, RuleLine, Trajectory model are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/67-export-sheet.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/67-export-sheet.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/67-export-sheet.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/ExportSheet.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/ExportSheet.swift.
Create the directory trail-viewer/Sources/Views/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/ExportSheet.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/ExportSheet.swift && git commit -m "feat: add ExportSheet — export trajectory as Markdown, JSON, or Timeline with copy and save"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("67-export-sheet:", result.status);
