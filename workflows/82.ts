import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("82-ws-types")
  .description(
    "Create trail-viewer/server/src/ws-types.ts — TypeScript interfaces for WebSocket message types",
  )
  .pattern("pipeline")
  .channel("wf-82-ws-types")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript type system designer for WebSocket protocol",
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
    task: `Output the COMPLETE contents of a TypeScript file: ws-types.ts for the Trail Viewer server.

Requirements:
- Define all WebSocket message types as TypeScript interfaces
- Use discriminated unions with a "type" field

SERVER TO CLIENT messages:

1. AgentMessageEvent:
   - type: "agent_message" (literal string)
   - from: string (agent/persona identifier)
   - content: string (the message text)
   - persona: { id: string; name: string; emoji: string; color: string } | null
   - timestamp: string (ISO date string)

2. TypingEvent:
   - type: "typing"
   - persona: string (persona id)
   - isTyping: boolean

3. SessionStartedEvent:
   - type: "session_started"
   - sessionId: string
   - personas: string[] (list of active persona ids)

4. ErrorEvent:
   - type: "error"
   - message: string
   - code?: string

- Export type ServerToClientMessage = AgentMessageEvent | TypingEvent | SessionStartedEvent | ErrorEvent

CLIENT TO SERVER messages:

1. SendMessagePayload:
   - type: "send_message"
   - sessionId: string
   - message: string
   - personas: string[] (target persona ids)

2. StartSessionPayload:
   - type: "start_session"
   - trajectoryId: string
   - personas: string[]
   - preferredCLI?: string

3. StopSessionPayload:
   - type: "stop_session"
   - sessionId: string

4. AddPersonaPayload:
   - type: "add_persona"
   - sessionId: string
   - personaId: string

5. RemovePersonaPayload:
   - type: "remove_persona"
   - sessionId: string
   - personaId: string

- Export type ClientToServerMessage = SendMessagePayload | StartSessionPayload | StopSessionPayload | AddPersonaPayload | RemovePersonaPayload

- Export a type guard function: isClientMessage(data: unknown): data is ClientToServerMessage
  - Checks that data is an object with a valid "type" field

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/82-ws-types.md on disk. This ensures clean handoff to the implementer.`,
    verification: { type: "file_exists", value: ".relay/specs/82-ws-types.md" },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/82-ws-types.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/ws-types.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/ws-types.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/ws-types.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/ws-types.ts && git commit -m "feat: add WebSocket type definitions — server/client message interfaces"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("82-ws-types:", result.status);
