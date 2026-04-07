import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("15-chat-models")
  .description(
    "Create trail-viewer/Sources/Data/ChatModels.swift — chat message, persona, and session types",
  )
  .pattern("pipeline")
  .channel("wf-15-chat-models")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift data model architect",
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
    task: `Output the COMPLETE contents of a ChatModels.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation

2. ChatSessionState enum (String, Codable, Hashable):
   - idle, connecting, active, disconnected, error

3. TypingState enum (String, Codable, Hashable):
   - idle, typing, thinking

4. ChatPersona (struct, Codable, Identifiable, Hashable):
   - id: String
   - name: String
   - emoji: String
   - description: String
   - colorHex: String
   - CodingKeys mapping color_hex -> colorHex

   Computed:
   - color: Color (using Color(hex: colorHex)) — import SwiftUI needed

5. ChatMessage (struct, Codable, Identifiable, Hashable):
   - id: UUID (default UUID())
   - from: String (agent name or "user")
   - content: String
   - persona: String? (persona id, if from an agent)
   - timestamp: Date (default Date())
   - CodingKeys for all properties

   Computed:
   - isUser: Bool { from == "user" }
   - isSystem: Bool { from == "system" }

6. ChatWebSocketMessage (struct, Codable):
   - type: String (e.g., "agent_message", "typing", "error")
   - sessionId: String?
   - from: String?
   - content: String?
   - persona: String?
   - CodingKeys mapping session_id -> sessionId

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "ChatMessage" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/ChatModels.swift from this spec:

{{steps.plan.output}}

Extract the ChatModels.swift code and write it to trail-viewer/Sources/Data/ChatModels.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/ChatModels.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/ChatModels.swift && git commit -m "feat: add ChatModels.swift — chat message, persona, and session types"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("15-chat-models:", result.status);
