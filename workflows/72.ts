import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("72-server-entry")
  .description(
    "Create trail-viewer/server/src/server.ts — Hono HTTP server with CORS, health, and placeholder routes",
  )
  .pattern("pipeline")
  .channel("wf-72-server-entry")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Node.js HTTP server architect",
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
    task: `Output the COMPLETE contents of a TypeScript file: server.ts for the Trail Viewer local server.

Requirements:
- ESM module (import/export syntax)
- Import Hono framework:
  - import { Hono } from "hono"
  - import { cors } from "hono/cors"
  - import { serve } from "@hono/node-server"
- Import local modules:
  - import { healthHandler, config } from "./health.js"
- Create app:
  - const app = new Hono()
- Middleware:
  - CORS: app.use("*", cors()) — allow all origins (local dev server)
  - JSON error handler:
    - app.onError((err, c) => {
        console.error("Server error:", err.message)
        return c.json({ error: err.message, status: 500 }, 500)
      })
  - Not found handler:
    - app.notFound((c) => {
        return c.json({ error: "Not found", status: 404 }, 404)
      })
- Routes:
  1. Health check:
     - app.get("/health", (c) => c.json(healthHandler()))
  2. Trajectory routes (placeholder group):
     - const trajectories = new Hono()
     - trajectories.get("/", (c) => c.json({ trajectories: [], message: "TODO: list trajectories" }))
     - trajectories.get("/:id", (c) => c.json({ trajectory: null, message: "TODO: get trajectory by id", id: c.req.param("id") }))
     - app.route("/api/trajectories", trajectories)
  3. Chat routes (placeholder group):
     - const chat = new Hono()
     - chat.post("/sessions", (c) => c.json({ session: null, message: "TODO: create chat session" }))
     - chat.post("/sessions/:id/messages", (c) => c.json({ message: null, note: "TODO: send message to session" }))
     - app.route("/api/chat", chat)
  4. Persona routes (placeholder group):
     - const personas = new Hono()
     - personas.get("/", (c) => c.json({ personas: [], message: "TODO: list personas" }))
     - app.route("/api/personas", personas)
- Server startup:
  - const server = serve({
      fetch: app.fetch,
      hostname: config.host,
      port: config.port,
    }, (info) => {
      console.log("")
      console.log("  ╔══════════════════════════════════════╗")
      console.log("  ║   Trail Viewer Server                ║")
      console.log("  ╠══════════════════════════════════════╣")
      console.log(\`  ║   Local:  http://\${config.host}:\${config.port}  ║\`)
      console.log(\`  ║   Health: http://\${config.host}:\${config.port}/health  ║\`)
      console.log("  ╚══════════════════════════════════════╝")
      console.log("")
      console.log(\`  Trajectory path: \${config.trajectoryPath}\`)
      console.log(\`  PID: \${process.pid}\`)
      console.log("")
    })
- Graceful shutdown:
  - process.on("SIGINT", () => { console.log("\\nShutting down..."); server.close(); process.exit(0) })
  - process.on("SIGTERM", () => { server.close(); process.exit(0) })
- Export app for testing:
  - export { app }
- Add JSDoc comment at top explaining this is the Trail Viewer local HTTP server

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "Hono" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/server.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/server.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/server.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/server.ts && git commit -m "feat: add Hono server entry — CORS, health endpoint, and placeholder route groups"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("72-server-entry:", result.status);
