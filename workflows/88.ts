import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("88-test-api")
  .description(
    "Create trail-viewer/server/src/test-api.ts — REST API integration test script",
  )
  .pattern("pipeline")
  .channel("wf-88-test-api")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript test engineer for REST API testing",
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
    task: `Output the COMPLETE contents of a TypeScript file: test-api.ts — REST API test script for the Trail Viewer server.

Requirements:
- This is a standalone script run with: npx tsx src/test-api.ts
- Uses native fetch() (available in Node 18+)
- const BASE_URL = process.env.BASE_URL || "http://localhost:3847"

- Track results: { endpoint: string; passed: boolean; error?: string; status?: number }[]

- Helper: async function testEndpoint(name, url, options?): Promise<{ passed, error?, status? }>
  - Call fetch(url, options)
  - Return passed: true if response.ok (2xx), include status
  - Return passed: false with error message if not ok or throws

- Test cases:

  1. "GET /health"
     - Fetch BASE_URL + "/health"
     - Verify status 200
     - Verify response JSON has { status: "ok" }

  2. "GET /api/trajectories"
     - Fetch BASE_URL + "/api/trajectories"
     - Verify status 200
     - Verify response is an array

  3. "GET /api/trajectories/:id"
     - Fetch BASE_URL + "/api/trajectories/traj-jwt-auth-001" (known mock id)
     - Verify status 200
     - Verify response has id, title, status fields

  4. "GET /api/trajectories/:id (not found)"
     - Fetch BASE_URL + "/api/trajectories/nonexistent-id"
     - Verify status 404

  5. "GET /api/stats"
     - Fetch BASE_URL + "/api/stats"
     - Verify status 200
     - Verify response has total, active, completed, abandoned fields

  6. "GET /api/trajectories/:id/markdown"
     - Fetch BASE_URL + "/api/trajectories/traj-jwt-auth-001/markdown"
     - Verify status 200
     - Verify content-type contains "text/plain"
     - Verify body is non-empty string

  7. "GET /api/trajectories/:id/timeline"
     - Fetch BASE_URL + "/api/trajectories/traj-jwt-auth-001/timeline"
     - Verify status 200

  8. "GET /api/trajectories/:id/json"
     - Fetch BASE_URL + "/api/trajectories/traj-jwt-auth-001/json"
     - Verify status 200
     - Verify content-type contains "application/json"

  9. "GET /api/personas"
     - Fetch BASE_URL + "/api/personas"
     - Verify status 200
     - Verify response is an array with length >= 1

- Print results:
  - For each: "[PASS]" or "[FAIL]" + endpoint name + status code + error if failed
  - Summary: "X/Y endpoints passed"
  - process.exit(0) if all passed, process.exit(1) if any failed

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "test-api" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/test-api.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/test-api.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/test-api.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/test-api.ts && git commit -m "feat: add REST API integration test script"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("88-test-api:", result.status);
