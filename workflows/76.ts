import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("76-routes-exports")
  .description(
    "Create trail-viewer/server/src/routes/exports.ts — Hono routes for markdown/timeline/JSON export",
  )
  .pattern("pipeline")
  .channel("wf-76-routes-exports")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript API route designer",
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
    task: `Output the COMPLETE contents of a TypeScript file: exports.ts (Hono route group) for the Trail Viewer server.

Requirements:
- Import Hono from 'hono'
- Import TrajectoryService from '../trajectory-service'

- Export a factory function: createExportRoutes(service: TrajectoryService): Hono
- Create a Hono app instance inside the factory

- Routes:

  1. GET /trajectories/:id/markdown
     - Call service.getTrajectoryMarkdown(id)
     - If empty string (not found), return 404 with text "Trajectory not found"
     - Return as text/plain content type using c.text()

  2. GET /trajectories/:id/timeline
     - Call service.getTrajectoryTimeline(id)
     - If empty string (not found), return 404 with text "Trajectory not found"
     - Return as text/plain content type using c.text()

  3. GET /trajectories/:id/json
     - Call service.getTrajectory(id)
     - If null, return 404 with JSON { error: "Trajectory not found" }
     - Return full trajectory as application/json using c.json()

- Each route wrapped in try/catch
- 500 status with error message on exceptions
- Export the factory function as default

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "createExportRoutes" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/routes/exports.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/routes/exports.ts.
Create the directory trail-viewer/server/src/routes/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/routes/exports.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/routes/exports.ts && git commit -m "feat: add export routes — markdown, timeline, and JSON trajectory exports"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("76-routes-exports:", result.status);
