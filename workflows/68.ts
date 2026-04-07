import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("68-file-detail-modal")
  .description(
    "Create trail-viewer/Sources/Views/FileDetailModal.swift — fullscreen file viewer with list and content panes",
  )
  .pattern("pipeline")
  .channel("wf-68-file-detail-modal")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI modal overlay designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: FileDetailModal.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct FileDetailModal: View
- Properties:
  - files: [FileChange] (struct with path: String, status: String like "added"/"modified"/"deleted", additions: Int, deletions: Int, content: String?)
  - @Binding var isPresented: Bool
- @State private var selectedFileIndex: Int = 0
- Layout:
  - ZStack:
    1. Backdrop:
       - Theme.textPrimary.opacity(0.3) — dark overlay
       - .onTapGesture { isPresented = false }
       - .ignoresSafeArea()
    2. Main panel — centered, inset from edges:
       - HStack(spacing: 0):
         a. File list (left pane, 240pt width):
            - VStack(spacing: 0):
              - Text("Files") in Typography.heading, .padding(Theme.spacingMD)
              - RuleLine()
              - ScrollView:
                - ForEach(Array(files.enumerated()), id: \\.offset) { index, file in
                    Button(action: { selectedFileIndex = index }):
                      HStack:
                        - Image(systemName: fileIcon(for: file.status))
                          .foregroundColor(fileStatusColor(for: file.status))
                          .frame(width: 16)
                        - VStack(alignment: .leading, spacing: 2):
                          - Text(fileName(from: file.path)) in Typography.body
                            .lineLimit(1)
                          - Text(file.path) in Typography.caption, Theme.textTertiary
                            .lineLimit(1).truncationMode(.head)
                        - Spacer()
                        - If file.additions > 0 or file.deletions > 0:
                          - HStack(spacing: 2):
                            - Text("+\\(file.additions)").foregroundColor(.green).font(Typography.caption)
                            - Text("-\\(file.deletions)").foregroundColor(.red).font(Typography.caption)
                      .padding(.horizontal, Theme.spacingMD)
                      .padding(.vertical, Theme.spacingSM)
                      .background(selectedFileIndex == index ? Theme.blue.opacity(0.1) : Color.clear)
                    .buttonStyle(.plain)
                  }
            - .background(Theme.sidebarBg)
            - .frame(width: 240)
            - Right border: Rectangle().fill(Theme.borderLight).frame(width: 0.5)
         b. File content (right pane):
            - VStack(spacing: 0):
              - Header:
                - HStack:
                  - Text(selectedFile.path) in Typography.caption.monospaced(), Theme.textSecondary
                  - Spacer()
                  - Text("\\(selectedFile.additions) additions, \\(selectedFile.deletions) deletions") in Typography.caption, Theme.textTertiary
                  - Button(action: { isPresented = false }):
                    - Image(systemName: "xmark.circle.fill") in Theme.textTertiary, 16pt
                  - .buttonStyle(.plain)
                - .padding(Theme.spacingMD)
                - RuleLine()
              - ScrollView([.horizontal, .vertical]):
                - If selectedFile.content exists:
                  - CodeContentView showing line numbers + content:
                    - HStack(alignment: .top, spacing: 0):
                      - Line numbers column: VStack of Text for each line number, right-aligned, Theme.textTertiary, monospaced, 40pt width, sidebarBg background
                      - Vertical separator
                      - Text(content) in monospaced font, Theme.textPrimary, with .textSelection(.enabled)
                - Else:
                  - Text("Content not available") centered, Theme.textTertiary
              - .background(Theme.pageBg)
       - .frame(maxWidth: .infinity, maxHeight: .infinity)
       - .padding(40) — inset from screen edges
       - .background(Theme.pageBg)
       - .clipShape(RoundedRectangle(cornerRadius: 12))
       - .shadow(color: .black.opacity(0.2), radius: 30, y: 10)

  - Keyboard handling:
    - Esc: isPresented = false
    - Left arrow: selectedFileIndex = max(0, selectedFileIndex - 1)
    - Right arrow: selectedFileIndex = min(files.count - 1, selectedFileIndex + 1)
    - Use .onExitCommand and .onKeyPress or local event monitor

- Helper functions:
  - fileIcon(for status: String) -> String (plus.circle for added, pencil.circle for modified, minus.circle for deleted)
  - fileStatusColor(for status: String) -> Color (green, Theme.blue, red)
  - fileName(from path: String) -> String (last path component)

- Assume Theme, Typography, RuleLine, FileChange model are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "FileDetailModal" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/FileDetailModal.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/FileDetailModal.swift.
Create the directory trail-viewer/Sources/Views/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/FileDetailModal.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/FileDetailModal.swift && git commit -m "feat: add FileDetailModal — fullscreen file viewer with list pane and line-numbered content"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("68-file-detail-modal:", result.status);
