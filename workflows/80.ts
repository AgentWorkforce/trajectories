import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("80-chat-service")
  .description(
    "Create trail-viewer/server/src/chat-service.ts — thin facade over ChatSession for session management",
  )
  .pattern("pipeline")
  .channel("wf-80-chat-service")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for chat service facade",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "TypeScript implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a TypeScript file: chat-service.ts for the Trail Viewer server.

Requirements:
- Import { ChatSession, MessageCallback, TypingCallback, ChatMessage } from './chat-session'
- Import { PERSONAS, getAllPersonas, Persona } from './personas'
- Import { randomUUID } from 'crypto'

- Export class ChatService:
  Properties:
  - private sessions: Map<string, ChatSession>
  - private messageCallbacks: Set<MessageCallback>
  - private typingCallbacks: Set<TypingCallback>

  Constructor():
  - Initialize sessions = new Map()
  - Initialize messageCallbacks = new Set()
  - Initialize typingCallbacks = new Set()

  Methods:

  async startSession(trajectoryId: string, trajectoryContext: string, personaIds: string[], preferredCLI?: string): Promise<string>
  - Create new ChatSession(trajectoryId, trajectoryContext, preferredCLI)
  - Wire session.onMessage to broadcast to all registered messageCallbacks
  - Wire session.onTyping to broadcast to all registered typingCallbacks
  - Call session.startSession(personaIds)
  - Store session in sessions map by session.sessionId
  - Return session.sessionId

  async sendMessage(sessionId: string, text: string, targetPersonas: string[]): Promise<void>
  - Get session from sessions map
  - Throw Error if session not found: "Session not found: {sessionId}"
  - Call session.sendMessage(text, targetPersonas)

  async addPersona(sessionId: string, personaId: string): Promise<void>
  - Get session, throw if not found
  - Call session.addPersona(personaId)

  async removePersona(sessionId: string, personaId: string): Promise<void>
  - Get session, throw if not found
  - Call session.removePersona(personaId)

  async stopSession(sessionId: string): Promise<void>
  - Get session, throw if not found
  - Call session.stop()
  - Remove from sessions map

  getPersonas(): Persona[]
  - Return getAllPersonas()

  onMessage(callback: MessageCallback): void
  - Add callback to messageCallbacks set

  onTyping(callback: TypingCallback): void
  - Add callback to typingCallbacks set

  private broadcastMessage(message: ChatMessage): void
  - For each callback in messageCallbacks, call callback(message)

  private broadcastTyping(personaId: string, isTyping: boolean): void
  - For each callback in typingCallbacks, call callback(personaId, isTyping)

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "ChatService" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/chat-service.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/chat-service.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/chat-service.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/chat-service.ts && git commit -m "feat: add ChatService — session management facade with callback broadcasting"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("80-chat-service:", result.status);
