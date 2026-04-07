import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("25-app-state-store")
  .description(
    "Create trail-viewer/Sources/Data/AppStateStore.swift — window state, recent paths, UI preferences",
  )
  .pattern("pipeline")
  .channel("wf-25-app-state-store")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift state management architect",
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
    task: `Output the COMPLETE contents of an AppStateStore.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable and NSOpenPanel via AppKit)
3. Import AppKit (for NSOpenPanel)

4. @Observable class AppStateStore:

   Static:
   - recentPathsKey = "AppStateStore.recentPaths"
   - currentPathKey = "AppStateStore.currentPath"
   - showChatPanelKey = "AppStateStore.showChatPanel"
   - sidebarVisibleKey = "AppStateStore.sidebarVisible"
   - selectedTabKey = "AppStateStore.selectedTab"
   - maxRecentPaths = 10

   Properties:
   - var recentPaths: [String] = [] { didSet { persistState() } }
   - var currentPath: String? = nil { didSet { persistState() } }
   - var showChatPanel: Bool = true { didSet { persistState() } }
   - var sidebarVisible: Bool = true { didSet { persistState() } }
   - var selectedTab: String = "trajectories" { didSet { persistState() } }

   Initializer:
   - init() calls loadState()

   Methods:

   addRecentPath(_ path: String):
   - Remove path from recentPaths if already present (dedup)
   - Insert at index 0
   - If count exceeds maxRecentPaths, trim from end
   - (didSet on recentPaths handles persistence)

   openPath() -> String?:
   - Show NSOpenPanel configured for directory selection:
     - canChooseDirectories = true
     - canChooseFiles = false
     - allowsMultipleSelection = false
     - message = "Select a trajectory data directory"
     - prompt = "Open"
   - If user selects a path:
     - Set currentPath to selected path string
     - Call addRecentPath with the path
     - Return the path
   - Else return nil

   persistState():
   - Save all properties to UserDefaults:
     - recentPaths as JSON Data
     - currentPath as String (optional)
     - showChatPanel as Bool
     - sidebarVisible as Bool
     - selectedTab as String

   loadState():
   - Read all properties from UserDefaults
   - Use defaults if keys not found: recentPaths=[], currentPath=nil, showChatPanel=true, sidebarVisible=true, selectedTab="trajectories"

   clearRecentPaths():
   - recentPaths = []

   toggleSidebar():
   - sidebarVisible.toggle()

   toggleChatPanel():
   - showChatPanel.toggle()

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/25-app-state-store.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/25-app-state-store.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/25-app-state-store.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Data/AppStateStore.swift from this spec:

{{steps.read-spec.output}}

Extract the AppStateStore.swift code and write it to trail-viewer/Sources/Data/AppStateStore.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/AppStateStore.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/AppStateStore.swift && git commit -m "feat: add AppStateStore.swift — window state, recent paths, UI preferences"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("25-app-state-store:", result.status);
