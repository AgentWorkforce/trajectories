import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("71-health-endpoint")
  .description(
    "Create trail-viewer/server/src/health.ts — health check handler and environment config",
  )
  .pattern("pipeline")
  .channel("wf-71-health-endpoint")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Node.js API designer",
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
    task: `Output the COMPLETE contents of a TypeScript file: health.ts for the Trail Viewer local server.

Requirements:
- ESM module (no require, use import/export)
- Export environment configuration:
  - export const config = {
      port: parseInt(process.env.PORT || "3847", 10),
      host: process.env.HOST || "127.0.0.1",
      trajectoryPath: process.env.TRAJECTORIES_DATA_DIR || "./data",
    }
- Export the startup time:
  - const startedAt = Date.now()
- Export the health handler function:
  - export function healthHandler() {
      return {
        status: "ok" as const,
        pid: process.pid,
        port: config.port,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        trajectoryPath: config.trajectoryPath,
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      }
    }
- Export the type:
  - export type HealthResponse = ReturnType<typeof healthHandler>
- Keep it simple, focused, no external dependencies
- Add JSDoc comments for the config and handler

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/71-health-endpoint.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/71-health-endpoint.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/71-health-endpoint.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/health.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/health.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/health.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/health.ts && git commit -m "feat: add health endpoint handler with env config for trail-viewer-server"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("71-health-endpoint:", result.status);
