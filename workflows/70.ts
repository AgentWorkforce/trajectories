import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("70-server-scaffold")
  .description(
    "Create trail-viewer/server/package.json AND trail-viewer/server/tsconfig.json",
  )
  .pattern("pipeline")
  .channel("wf-70-server-scaffold")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Node.js project scaffold architect",
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
    task: `Output the COMPLETE contents of TWO files for the Trail Viewer local server.

FILE 1: package.json
- name: trail-viewer-server, version 1.0.0, type: module
- dependencies: agent-trajectories (file:../../), @agent-relay/sdk, hono, @hono/node-server, ws
- devDependencies: @types/ws, tsx, typescript
- scripts: dev (tsx watch src/server.ts), start (node dist/server.js), build (tsc)

FILE 2: tsconfig.json
- target ES2022, module ESNext, moduleResolution bundler, strict, esModuleInterop
- outDir dist, rootDir src, include src/**/*.ts

Output both files clearly labeled with their filenames and complete JSON contents.

IMPORTANT: Write your complete output to the file .relay/specs/70-server-scaffold.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/70-server-scaffold.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/70-server-scaffold.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create TWO files for the Trail Viewer server from this spec:

{{steps.read-spec.output}}

1. Create trail-viewer/server/package.json
2. Create trail-viewer/server/tsconfig.json

Create the directory trail-viewer/server/ if it does not exist.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/package.json",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/package.json server/tsconfig.json && git commit -m "chore: add server scaffold — package.json and tsconfig.json"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("70-server-scaffold:", result.status);
