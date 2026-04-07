import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("75-routes-trajectories")
  .description(
    "Create trail-viewer/server/src/routes/trajectories.ts — Hono route group for trajectory CRUD",
  )
  .pattern("pipeline")
  .channel("wf-75-routes-trajectories")
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
    task: `Output the COMPLETE contents of a TypeScript file: trajectories.ts (Hono route group) for the Trail Viewer server.

Requirements:
- Import Hono from 'hono'
- Import TrajectoryService from '../trajectory-service'

- Create and export a Hono app instance (const trajectories = new Hono())
- The route group will be mounted at /api by the main server

- Routes:

  1. GET /trajectories
     - Query params: status (optional string), search (optional string), tags (optional comma-separated string)
     - Parse tags from comma-separated string to string[]
     - Call trajectoryService.listTrajectories({ status, search, tags })
     - Return JSON array of TrajectorySummary
     - Wrap in try/catch, return 500 on error with { error: message }

  2. GET /trajectories/:id
     - Extract id from params
     - Call trajectoryService.getTrajectory(id)
     - If null, return 404 with { error: "Trajectory not found" }
     - Return JSON trajectory object

  3. GET /stats
     - Call trajectoryService.getStats()
     - Return JSON stats object

- The TrajectoryService instance should be created at module level or accept it via a factory function
  - Prefer: export function createTrajectoryRoutes(service: TrajectoryService): Hono pattern
  - This allows dependency injection from the main server

- All responses use c.json() for JSON or c.text() for plain text
- Proper error handling with try/catch on each route
- Set appropriate status codes: 200 success, 404 not found, 500 server error

- Export default the route group (or the factory function)

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "trajectories" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/routes/trajectories.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/routes/trajectories.ts.
Create the directory trail-viewer/server/src/routes/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/routes/trajectories.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/routes/trajectories.ts && git commit -m "feat: add trajectory API routes — list, get, stats endpoints"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("75-routes-trajectories:", result.status);
