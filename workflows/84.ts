import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("84-server-main")
  .description(
    "Rewrite trail-viewer/server/src/server.ts — final wired server with all routes, services, and WebSocket bridge",
  )
  .pattern("pipeline")
  .channel("wf-84-server-main")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for server assembly",
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
    task: `Output the COMPLETE contents of a TypeScript file: server.ts — the main entry point for the Trail Viewer server. This is a REWRITE of the existing file.

Requirements:
- Import { serve } from '@hono/node-server'
- Import { Hono } from 'hono'
- Import { cors } from 'hono/cors'
- Import { TrajectoryService } from './trajectory-service'
- Import { ChatService } from './chat-service'
- Import { RelayBridge } from './relay-bridge'
- Import { createTrajectoryRoutes } from './routes/trajectories'
- Import { createExportRoutes } from './routes/exports'
- Import { createChatRoutes } from './routes/chat'

- const PORT = parseInt(process.env.PORT || "3847", 10)

- Main startup logic (top-level await or async main):

  1. Initialize TrajectoryService:
     - const trajectoryService = new TrajectoryService()
     - await trajectoryService.init()
     - console.log("Trajectory service initialized")

  2. Create ChatService:
     - const chatService = new ChatService()

  3. Create Hono app:
     - const app = new Hono()
     - Enable CORS: app.use('/*', cors())

  4. Health check:
     - app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  5. Mount route groups:
     - app.route('/api', createTrajectoryRoutes(trajectoryService))
     - app.route('/api', createExportRoutes(trajectoryService))
     - app.route('/api', createChatRoutes(chatService, trajectoryService))

  6. Start server using @hono/node-server serve():
     - const server = serve({ fetch: app.fetch, port: PORT })
     - This returns a Node.js http.Server

  7. Attach RelayBridge:
     - const bridge = new RelayBridge(server, chatService, trajectoryService)

  8. Log startup banner:
     - console.log("=".repeat(50))
     - console.log("Trail Viewer Server")
     - console.log("Port: {PORT}")
     - console.log("Health: http://localhost:{PORT}/health")
     - console.log("API: http://localhost:{PORT}/api/trajectories")
     - console.log("WebSocket: ws://localhost:{PORT}/ws")
     - console.log("=".repeat(50))

  9. Graceful shutdown:
     - process.on('SIGINT', async () => { bridge.close(); server.close(); process.exit(0); })
     - process.on('SIGTERM', async () => { bridge.close(); server.close(); process.exit(0); })

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/84-server-main.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/84-server-main.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/84-server-main.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `REWRITE trail-viewer/server/src/server.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and OVERWRITE trail-viewer/server/src/server.ts with the new content.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: { type: "exit_code", value: "0" },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/server.ts && git commit -m "feat: rewrite server.ts — wire all routes, services, and WebSocket bridge"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("84-server-main:", result.status);
