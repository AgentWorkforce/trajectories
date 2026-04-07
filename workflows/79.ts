import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("79-chat-session")
  .description(
    "Create trail-viewer/server/src/chat-session.ts — ChatSession class managing agent spawning and messaging",
  )
  .pattern("pipeline")
  .channel("wf-79-chat-session")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for real-time chat orchestration",
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
    task: `Output the COMPLETE contents of a TypeScript file: chat-session.ts (~250 lines) for the Trail Viewer server.

Requirements:
- Import AgentRelay from '@agent-relay/sdk' (or similar — the relay SDK for spawning and messaging)
- Import { resolveSpawnConfig } from './cli-resolver'
- Import { PERSONAS, buildPersonaPrompt, stripThinking, stripAnsi, Persona } from './personas'
- Import { randomUUID } from 'crypto'

- Define and export interface ChatMessage:
  - id: string
  - from: string (persona id or "user")
  - content: string
  - persona?: Persona
  - timestamp: Date

- Define and export type MessageCallback = (message: ChatMessage) => void
- Define and export type TypingCallback = (personaId: string, isTyping: boolean) => void

- Export class ChatSession:
  Properties:
  - readonly sessionId: string (generated UUID)
  - readonly trajectoryId: string
  - readonly channel: string (format: "chat-traj-{trajectoryId}")
  - private relay: AgentRelay
  - private agents: Map<string, { personaId: string; agentName: string }> (tracks spawned agents)
  - private trajectoryContext: string
  - private preferredCLI: string | undefined
  - onMessage: MessageCallback | null
  - onTyping: TypingCallback | null

  Constructor(trajectoryId: string, trajectoryContext: string, preferredCLI?: string):
  - Set sessionId = randomUUID()
  - Set trajectoryId, trajectoryContext, preferredCLI
  - Set channel = "chat-traj-" + trajectoryId
  - Initialize relay = new AgentRelay() (or appropriate constructor)
  - Initialize agents = new Map()
  - Initialize onMessage = null, onTyping = null

  async startSession(personaIds: string[]): Promise<void>
  - For each personaId in personaIds:
    - Get persona from PERSONAS[personaId], skip if not found
    - Build persona prompt using buildPersonaPrompt(persona, trajectoryContext)
    - Resolve spawn config using resolveSpawnConfig(preferredCLI)
    - Generate agent name: "persona-{personaId}-{sessionId.slice(0,8)}"
    - Spawn agent via relay with the persona prompt as task/system message
    - Store in agents map: agentName -> { personaId, agentName }
  - Subscribe to channel for incoming messages
  - Set up message handler via relay.on('message') or similar:
    - When message arrives on channel, call handleChannelMessage

  async sendMessage(text: string, targetPersonas: string[]): Promise<void>
  - Post message to channel via relay
  - For each target persona, inject the user message into the agent's PTY/stdin
  - Format: "User says: {text}"

  private handleChannelMessage(envelope: any): void
  - Extract sender, content from envelope
  - Find which persona sent it (look up in agents map)
  - Clean content: stripThinking(stripAnsi(content))
  - Build ChatMessage object
  - Emit via onMessage callback if set
  - Cross-agent fanout: for each OTHER agent in the session, inject the message into their PTY
    - Format: "{persona.name} says: {cleanedContent}"

  async addPersona(personaId: string): Promise<void>
  - Same spawn logic as in startSession but for a single persona
  - Add to agents map

  async removePersona(personaId: string): Promise<void>
  - Find agent by personaId in agents map
  - Release/kill the agent via relay
  - Remove from agents map

  async stop(): Promise<void>
  - For each agent in agents map, release via relay
  - Clear agents map
  - Unsubscribe from channel

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/79-chat-session.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/79-chat-session.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/79-chat-session.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/chat-session.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/chat-session.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/chat-session.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/chat-session.ts && git commit -m "feat: add ChatSession — agent spawning, messaging, and cross-agent fanout"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("79-chat-session:", result.status);
