import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("47-file-changes-view")
  .description(
    "Create trail-viewer/Sources/Views/Detail/FileChangesView.swift — collapsible file and commit list footer",
  )
  .pattern("pipeline")
  .channel("wf-47-file-changes")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI file changes designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: FileChangesView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct FileChangesView: View
- Properties:
  - files: [String] (file paths changed)
  - commits: [CommitInfo] (assume CommitInfo has: hash (String), message (String))
- @State private var showFiles: Bool = false
- @State private var showCommits: Bool = false
- Layout (VStack, alignment: .leading, spacing: spacingMD ~12pt):
  1. RuleLine divider at top
  2. Files section:
     - Header (tappable): HStack with doc.fill SF Symbol (Theme.textTertiary, 14pt) + "Files Changed ({files.count})" in Typography.sectionTitle + chevron indicator
     - Tap toggles showFiles
     - When expanded: VStack of file paths, each in Typography.code (monospace), Theme.textSecondary, with slight left indent
     - Animate expand/collapse
  3. Commits section:
     - Header (tappable): HStack with arrow.triangle.branch SF Symbol (Theme.textTertiary, 14pt) + "Commits ({commits.count})" in Typography.sectionTitle + chevron indicator
     - Tap toggles showCommits
     - When expanded: VStack of commit entries, each showing:
       - HStack: commit hash (first 7 chars) in Typography.code, Theme.blue + message in Typography.caption
     - Animate expand/collapse
  - Both sections collapsible independently
  - Animation: .easeInOut(duration: 0.25)
- Padding: spacingLG vertical
- Assume Theme, Typography, RuleLine are available from Design/ folder
- Add a PreviewProvider with mock file paths and commits

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/47-file-changes.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/47-file-changes.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/47-file-changes.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Detail/FileChangesView.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/FileChangesView.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/FileChangesView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/FileChangesView.swift && git commit -m "feat: add FileChangesView — collapsible file paths and commit list"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("47-file-changes-view:", result.status);
