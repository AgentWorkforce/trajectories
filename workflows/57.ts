import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("57-chat-panel-view")
  .description(
    "Create trail-viewer/Sources/Views/Chat/ChatPanelView.swift — full chat panel with messages, input, and persona selector",
  )
  .pattern("pipeline")
  .channel("wf-57-chat-panel")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI chat panel architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: ChatPanelView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct ChatPanelView: View
- @EnvironmentObject var chatStore: ChatStore
- @EnvironmentObject var trajectoryStore: TrajectoryStore
- @State private var scrollToBottom = false
- Assume ChatStore provides:
  - messages: [ChatMessage] — current session messages
  - isSessionActive: Bool
  - isTyping: Bool (whether an agent is typing)
  - typingPersona: ChatPersona? (persona currently typing)
  - startSession()
  - endSession()
  - sendMessage(_ text: String) async
  - personas: [ChatPersona]
- Assume TrajectoryStore provides:
  - selectedTrajectory: Trajectory? (with title property)
- Layout:
  - VStack(spacing: 0) with .frame(width: 340):
    1. Header:
       - VStack(alignment: .leading, spacing: 4):
         - HStack:
           - Text("Discuss") in Typography.sectionTitle (serif, ~18pt)
           - Spacer()
           - If chatStore.isSessionActive: Button("End Discussion") in Typography.caption, Theme.textTertiary, .buttonStyle(.plain)
         - If trajectoryStore.selectedTrajectory exists:
           - Text(trajectory title) in Typography.caption, Theme.textTertiary, .lineLimit(1)
       - .padding(Theme.spacingMD)
       - RuleLine() below header
    2. If chatStore.isSessionActive: PersonaSelector()
    3. Content area (flex):
       - If trajectoryStore.selectedTrajectory == nil:
         - NoTrajectorySelectedState()
       - Else if !chatStore.isSessionActive:
         - NoSessionStartedState(personaCount: chatStore.personas.count, onStartSession: { chatStore.startSession() })
       - Else if chatStore.messages.isEmpty:
         - NoMessagesHint()
       - Else:
         - ScrollViewReader { proxy in
             ScrollView(.vertical, showsIndicators: true):
               LazyVStack(spacing: Theme.spacingSM):
                 ForEach(chatStore.messages) { message in
                   ChatBubble(
                     message: message,
                     persona: chatStore.personas.first(where: { $0.id == message.personaId })
                   )
                   .id(message.id)
                 }
                 if chatStore.isTyping, let typingPersona = chatStore.typingPersona:
                   TypingIndicator(personaColor: Theme.agentColors[typingPersona.id] ?? Theme.blue)
               .padding(Theme.spacingMD)
             .onChange(of: chatStore.messages.count) { _ in
               if let lastId = chatStore.messages.last?.id {
                 withAnimation { proxy.scrollTo(lastId, anchor: .bottom) }
               }
             }
           }
    4. ChatInputBar(onSend: { text in Task { await chatStore.sendMessage(text) } })
  - Left border separator: .overlay(alignment: .leading) { Rectangle().fill(Theme.borderLight).frame(width: 0.5) }
  - Background: Theme.pageBg
  - .transition(.move(edge: .trailing)) for show/hide animation
- Assume all sub-views (PersonaSelector, ChatBubble, TypingIndicator, ChatInputBar, NoTrajectorySelectedState, NoSessionStartedState, NoMessagesHint, RuleLine) are available
- Assume Theme, Typography are available from Design/ folder
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "ChatPanelView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Chat/ChatPanelView.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Chat/ChatPanelView.swift.
Create the directory trail-viewer/Sources/Views/Chat/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/ChatPanelView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Chat/ChatPanelView.swift && git commit -m "feat: add ChatPanelView — full chat panel with messages, personas, and input"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("57-chat-panel-view:", result.status);
