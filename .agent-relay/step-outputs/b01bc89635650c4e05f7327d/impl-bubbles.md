Created  hatBubble.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Chat/ChatBubble.swift) and  hatInputBar.swift](/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/Sources/Views/Chat/ChatInputBar.swift) under `trail-viewer/Sources/Views/Chat/`.

`ChatBubble.swift` includes the bubble layout plus `SystemMessageView`, and it uses the repo’s chat helper types already present in the same folder. `ChatInputBar.swift` provides the multiline input, placeholder, send-state gating, and `Cmd+Return` send shortcut.

Verification: I ran a focused `swiftc -typecheck` against these two new files with local stubs for their dependencies, and that passed. A full `swift build` is currently failing for unrelated existing project issues outside these two files, including preview macro/plugin setup and pre-existing model/API errors elsewhere in the repo.
