import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("81-routes-chat")
  .description(
    "Create trail-viewer/server/src/routes/chat.ts — Hono route group for chat session management",
  )
  .pattern("pipeline")
  .channel("wf-81-routes-chat")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript API route designer for chat endpoints",
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
    task: `Output the COMPLETE contents of a TypeScript file: chat.ts (Hono route group) for the Trail Viewer server.

Requirements:
- Import Hono from 'hono'
- Import ChatService from '../chat-service'
- Import TrajectoryService from '../trajectory-service'
- Import { formatTrajectoryForAgent } from '../trajectory-formatter'

- Export function createChatRoutes(chatService: ChatService, trajectoryService: TrajectoryService): Hono
- Create a Hono app instance inside the factory

- Routes:

  1. POST /chat/start
     - Body: { trajectoryId: string, personas: string[], preferredCLI?: string }
     - Fetch trajectory via trajectoryService.getTrajectory(trajectoryId)
     - If not found, return 404 { error: "Trajectory not found" }
     - Format trajectory context using formatTrajectoryForAgent(trajectory)
     - Call chatService.startSession(trajectoryId, context, personas, preferredCLI)
     - Return 200 { sessionId }

  2. POST /chat/message
     - Body: { sessionId: string, message: string, personas: string[] }
     - Call chatService.sendMessage(sessionId, message, personas)
     - Return 200 { ok: true }
     - Catch errors: if "Session not found", return 404

  3. POST /chat/stop
     - Body: { sessionId: string }
     - Call chatService.stopSession(sessionId)
     - Return 200 { ok: true }
     - Catch errors: if "Session not found", return 404

  4. POST /chat/persona/add
     - Body: { sessionId: string, personaId: string }
     - Call chatService.addPersona(sessionId, personaId)
     - Return 200 { ok: true }

  5. POST /chat/persona/remove
     - Body: { sessionId: string, personaId: string }
     - Call chatService.removePersona(sessionId, personaId)
     - Return 200 { ok: true }

  6. GET /personas
     - Call chatService.getPersonas()
     - Return JSON array of personas

- All POST routes parse body with c.req.json()
- All routes wrapped in try/catch with 500 fallback
- Return the Hono app from the factory

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "createChatRoutes" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/routes/chat.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/routes/chat.ts.
Create the directory trail-viewer/server/src/routes/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/routes/chat.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/routes/chat.ts && git commit -m "feat: add chat API routes — session start, message, stop, persona add/remove"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("81-routes-chat:", result.status);
