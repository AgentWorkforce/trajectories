import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("83-relay-bridge")
  .description(
    "Create trail-viewer/server/src/relay-bridge.ts — WebSocket bridge connecting ChatService to browser clients",
  )
  .pattern("pipeline")
  .channel("wf-83-relay-bridge")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for WebSocket bridge",
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
    task: `Output the COMPLETE contents of a TypeScript file: relay-bridge.ts for the Trail Viewer server.

Requirements:
- Import { WebSocketServer, WebSocket } from 'ws'
- Import type { Server as HTTPServer } from 'http' (or 'node:http')
- Import ChatService from './chat-service'
- Import TrajectoryService from './trajectory-service'
- Import { formatTrajectoryForAgent } from './trajectory-formatter'
- Import { PERSONAS } from './personas'
- Import types from './ws-types': ServerToClientMessage, ClientToServerMessage, isClientMessage, AgentMessageEvent, TypingEvent, SessionStartedEvent, ErrorEvent

- Export class RelayBridge:
  Properties:
  - private wss: WebSocketServer
  - private clients: Set<WebSocket>
  - private chatService: ChatService
  - private trajectoryService: TrajectoryService

  Constructor(httpServer: HTTPServer, chatService: ChatService, trajectoryService: TrajectoryService):
  - Store chatService, trajectoryService
  - Initialize clients = new Set()
  - Create WebSocketServer attached to httpServer at path "/ws"
  - Set up wss.on('connection') handler:
    - Add ws to clients set
    - ws.on('message') -> handleClientMessage(ws, data)
    - ws.on('close') -> remove ws from clients set
    - ws.on('error') -> log error, remove ws from clients set

  - Wire ChatService callbacks:
    - chatService.onMessage((message) => {
        const persona = message.persona ? {
          id: message.persona.id,
          name: message.persona.name,
          emoji: message.persona.emoji,
          color: message.persona.color
        } : null;
        const event: AgentMessageEvent = {
          type: "agent_message",
          from: message.from,
          content: message.content,
          persona,
          timestamp: message.timestamp.toISOString()
        };
        this.broadcast(event);
      })
    - chatService.onTyping((personaId, isTyping) => {
        const event: TypingEvent = { type: "typing", persona: personaId, isTyping };
        this.broadcast(event);
      })

  private async handleClientMessage(ws: WebSocket, raw: Buffer | string): Promise<void>
  - Parse JSON from raw data
  - Validate with isClientMessage()
  - If invalid, send ErrorEvent back to ws
  - Switch on message.type:
    - "start_session":
      - Fetch trajectory from trajectoryService
      - Format context with formatTrajectoryForAgent
      - Call chatService.startSession(...)
      - Send SessionStartedEvent back to ws with sessionId and personas
    - "send_message":
      - Call chatService.sendMessage(sessionId, message, personas)
    - "stop_session":
      - Call chatService.stopSession(sessionId)
    - "add_persona":
      - Call chatService.addPersona(sessionId, personaId)
    - "remove_persona":
      - Call chatService.removePersona(sessionId, personaId)
  - Wrap each case in try/catch, send ErrorEvent on failure

  private broadcast(data: ServerToClientMessage): void
  - JSON.stringify the data
  - For each client in clients:
    - If client.readyState === WebSocket.OPEN, send the JSON string
    - Otherwise, remove from clients set (prune dead connections)

  close(): void
  - Close all client connections
  - Close the WebSocketServer

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/83-relay-bridge.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/83-relay-bridge.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/83-relay-bridge.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/relay-bridge.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/relay-bridge.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/relay-bridge.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/relay-bridge.ts && git commit -m "feat: add RelayBridge — WebSocket server bridging ChatService to browser clients"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("83-relay-bridge:", result.status);
