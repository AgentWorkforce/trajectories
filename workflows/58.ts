import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("58-command-palette")
  .description(
    "Create trail-viewer/Sources/Views/CommandPalette.swift — Cmd+K search overlay with grouped results",
  )
  .pattern("pipeline")
  .channel("wf-58-command-palette")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI overlay architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: CommandPalette.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct CommandPalette: View
- @Binding var isPresented: Bool
- @EnvironmentObject var trajectoryStore: TrajectoryStore
- @State private var searchText: String = ""
- @State private var selectedIndex: Int = 0
- @FocusState private var isSearchFocused: Bool
- Assume TrajectoryStore provides:
  - searchResults(for query: String) -> CommandPaletteResults (struct with trajectories: [Trajectory], decisions: [Decision], tags: [String])
  - selectTrajectory(id:)
- Layout:
  - ZStack (full-screen overlay):
    - Backdrop: Color.black.opacity(0.3) — semi-transparent dark backdrop
      - .onTapGesture { isPresented = false }
    - Centered panel:
      - VStack(spacing: 0):
        1. Search input:
           - HStack:
             - Image(systemName: "magnifyingglass") in Theme.textTertiary
             - TextField("Search trajectories, decisions, tags...", text: $searchText)
               - .font(Typography.heading) — serif heading font
               - .textFieldStyle(.plain)
               - .focused($isSearchFocused)
           - .padding(Theme.spacingMD)
           - Bottom border: RuleLine()
        2. Results area (ScrollView, max 8 results):
           - If searchText is not empty:
             - Let results = trajectoryStore.searchResults(for: searchText)
             - Group "Trajectories": ForEach results.trajectories (show title, highlight match in Theme.yellow)
             - Group "Decisions": ForEach results.decisions (show title, highlight match)
             - Group "Tags": ForEach results.tags (show tag name, highlight match)
             - Each group: Text group label in Typography.caption, Theme.textTertiary, uppercased, padding
             - Each result row: HStack with icon + text, highlight selected index with Theme.blue.opacity(0.1) bg
             - Max 8 total results shown
           - If searchText is empty: nothing or recent items
        3. Footer:
           - HStack:
             - Text("↑↓ Navigate") in Typography.caption, Theme.textTertiary
             - Text("·")
             - Text("↵ Open") in Typography.caption, Theme.textTertiary
             - Text("·")
             - Text("⎋ Close") in Typography.caption, Theme.textTertiary
           - .padding(Theme.spacingSM)
           - Top border: RuleLine()
      - .frame(width: 500, maxHeight: 400)
      - .background(Theme.pageBg)
      - .clipShape(RoundedRectangle(cornerRadius: 12))
      - .shadow(color: .black.opacity(0.15), radius: 20, y: 8)
  - Keyboard handling:
    - .onKeyPress(.downArrow): increment selectedIndex (wrap around)
    - .onKeyPress(.upArrow): decrement selectedIndex (wrap around)
    - .onKeyPress(.return): select item at selectedIndex, close palette
    - .onKeyPress(.escape): close palette
    - Or use .onExitCommand { isPresented = false } and manual key monitoring
  - Appear animation:
    - .scaleEffect(isPresented ? 1 : 0.95)
    - .opacity(isPresented ? 1 : 0)
    - .animation(.easeOut(duration: 0.15))
  - .onAppear { isSearchFocused = true }
  - Reset selectedIndex to 0 when searchText changes
- Helper: highlight matching text in Theme.yellow (#f2d479) background
- Assume Theme, Typography, RuleLine are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/58-command-palette.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/58-command-palette.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/58-command-palette.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/CommandPalette.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/CommandPalette.swift.
Create the directory trail-viewer/Sources/Views/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/CommandPalette.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/CommandPalette.swift && git commit -m "feat: add CommandPalette — Cmd+K overlay with grouped search results and keyboard nav"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("58-command-palette:", result.status);
