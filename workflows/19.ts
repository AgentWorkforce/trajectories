import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("19-relay-connection")
  .description(
    "Create trail-viewer/Sources/Data/RelayConnection.swift — WebSocket client for agent chat events",
  )
  .pattern("pipeline")
  .channel("wf-19-relay-connection")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift networking architect",
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
    task: `Output the COMPLETE contents of a RelayConnection.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable macro)

3. ConnectionState enum (String):
   - disconnected, connecting, connected, reconnecting, failed

4. @Observable class RelayConnection:

   Properties:
   - private(set) var state: ConnectionState = .disconnected
   - private(set) var messages: [ChatMessage] = []
   - private(set) var typingPersonas: Set<String> = []
   - private var webSocketTask: URLSessionWebSocketTask?
   - private var session: URLSession = .shared
   - private var wsBaseURL: URL = AppConfiguration.wsBaseURL
   - private var retryCount: Int = 0
   - private let maxRetries: Int = 5
   - private var isIntentionalDisconnect: Bool = false
   - private let decoder: JSONDecoder (configured with .convertFromSnakeCase)

   Methods:

   connect():
   - Set state to .connecting
   - Construct URL: wsBaseURL appending path "/ws"
   - Create URLSessionWebSocketTask
   - task.resume()
   - Set state to .connected, reset retryCount
   - Call receiveMessage() to start listening loop

   disconnect():
   - Set isIntentionalDisconnect = true
   - webSocketTask?.cancel(with: .normalClosure, reason: nil)
   - Set state to .disconnected
   - Clear typingPersonas

   send(sessionId: String, text: String, personas: [String]):
   - Encode a JSON payload: { "type": "user_message", "session_id": sessionId, "content": text, "personas": personas }
   - Send via webSocketTask?.send(.string(jsonString))

   Private receiveMessage():
   - Async loop: while webSocketTask != nil
   - try await webSocketTask?.receive()
   - Parse .string case as JSON ChatWebSocketMessage
   - Handle types:
     - "agent_message": create ChatMessage from fields, append to messages
     - "typing": add/remove from typingPersonas based on content
     - "error": log error
   - On error: attempt reconnect if not intentional

   Private reconnect():
   - Guard retryCount < maxRetries
   - Set state to .reconnecting
   - Exponential backoff: delay = 2^retryCount seconds (cap at 30s)
   - Try await Task.sleep
   - retryCount += 1
   - Call connect()
   - On max retries exceeded: set state to .failed

   clearMessages():
   - messages = []
   - typingPersonas = []

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/19-relay-connection.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/19-relay-connection.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/19-relay-connection.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Data/RelayConnection.swift from this spec:

{{steps.read-spec.output}}

Extract the RelayConnection.swift code and write it to trail-viewer/Sources/Data/RelayConnection.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/RelayConnection.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/RelayConnection.swift && git commit -m "feat: add RelayConnection.swift — WebSocket client with auto-reconnect"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("19-relay-connection:", result.status);
