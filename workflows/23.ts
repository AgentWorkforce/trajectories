import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("23-chat-store")
  .description(
    "Create trail-viewer/Sources/Data/ChatStore.swift — @Observable store for chat sessions, messages, personas",
  )
  .pattern("pipeline")
  .channel("wf-23-chat-store")
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
    task: `Output the COMPLETE contents of a ChatStore.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable macro)

3. @Observable class ChatStore:

   Properties:
   - private(set) var chatMessages: [ChatMessage] = []
   - private(set) var chatSessionId: String? = nil
   - private(set) var personas: [ChatPersona] = []
   - var activePersonas: Set<String> = [] (set of persona ids the user has selected)
   - private(set) var typingPersonas: Set<String> = []
   - private(set) var sessionState: ChatSessionState = .idle
   - private(set) var error: APIError? = nil
   - private let apiClient: APIClient
   - private let relayConnection: RelayConnection
   - private var observationTask: Task<Void, Never>?

   Initializer:
   - init(apiClient: APIClient = APIClient(), relayConnection: RelayConnection = RelayConnection())
   - Start observing relayConnection.messages and relayConnection.typingPersonas for changes

   Computed:
   - isActive: Bool { sessionState == .active }
   - hasSession: Bool { chatSessionId != nil }
   - activePersonasList: [ChatPersona] — personas filtered to those whose id is in activePersonas

   Methods:

   loadPersonas() async:
   - do/catch:
     - personas = try await apiClient.getPersonas()
     - Default: set activePersonas to all persona ids
   - Catch: set error

   startChat(trajectoryId: String) async:
   - Guard sessionState is .idle or .disconnected
   - Set sessionState = .connecting
   - do/catch:
     - let response = try await apiClient.startChatSession(trajectoryId: trajectoryId, personas: Array(activePersonas))
     - chatSessionId = response.sessionId
     - relayConnection.connect()
     - sessionState = .active
     - Start observing relay messages
   - Catch: sessionState = .error, set error

   sendMessage(text: String) async:
   - Guard isActive, chatSessionId is not nil, text is not empty
   - Create local ChatMessage(from: "user", content: text)
   - Append to chatMessages
   - do/catch:
     - try await apiClient.sendChatMessage(sessionId: chatSessionId!, message: text, personas: Array(activePersonas))
   - Catch: set error

   stopChat() async:
   - Guard chatSessionId is not nil
   - do/catch:
     - try await apiClient.stopChatSession(sessionId: chatSessionId!)
   - Catch: (ignore)
   - relayConnection.disconnect()
   - chatSessionId = nil
   - sessionState = .idle
   - relayConnection.clearMessages()

   Private startObservingRelay():
   - Set up a polling task or use withObservationTracking to sync relayConnection.messages -> chatMessages (append new ones) and relayConnection.typingPersonas -> typingPersonas

   togglePersona(_ personaId: String):
   - If activePersonas contains personaId, remove it; else insert it

   clearChat():
   - chatMessages = []

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "ChatStore" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/ChatStore.swift from this spec:

{{steps.plan.output}}

Extract the ChatStore.swift code and write it to trail-viewer/Sources/Data/ChatStore.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/ChatStore.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/ChatStore.swift && git commit -m "feat: add ChatStore.swift — @Observable store for chat sessions and messages"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("23-chat-store:", result.status);
