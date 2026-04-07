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
    task: `Output the COMPLETE TypeScript file: server.ts for the Trail Viewer local server.

Requirements:
- ESM (import/export)
- Import Hono, cors from hono/cors, serve from @hono/node-server
- Import healthHandler + config from ./health.js
- CORS: allow all origins (local dev)
- JSON error handler (500) and not-found handler (404)
- Routes:
  GET /health → healthHandler()
  /api/trajectories group: GET / (list), GET /:id (get by id) — placeholders
  /api/chat group: POST /sessions, POST /sessions/:id/messages — placeholders
  /api/personas group: GET / — placeholder
- Serve on config.host:config.port with startup banner showing URL and PID
- Graceful shutdown on SIGINT/SIGTERM
- Export app for testing

Output the complete TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/72-server-entry.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/72-server-entry.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/72-server-entry.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/server.ts from this spec:

{{steps.read-spec.output}}

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
      'cd trail-viewer && git add server/src/server.ts && git commit -m "feat: add Hono server entry — CORS, health, placeholder routes"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("72-server-entry:", result.status);
