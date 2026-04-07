import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("86-test-chat")
  .description(
    "Create trail-viewer/server/src/test-chat.ts — WebSocket integration test for chat sessions",
  )
  .pattern("pipeline")
  .channel("wf-86-test-chat")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript test engineer for WebSocket integration testing",
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
    task: `Output the COMPLETE contents of a TypeScript file: test-chat.ts — integration test script for the Trail Viewer chat WebSocket.

Requirements:
- Import WebSocket from 'ws'
- This is a standalone script run with: npx tsx src/test-chat.ts

- const WS_URL = process.env.WS_URL || "ws://localhost:3847/ws"
- Track results: { step: string; passed: boolean; error?: string }[]

- Helper: waitForMessage(ws, type, timeoutMs): Promise<any>
  - Returns a promise that resolves when a message with the specified type arrives
  - Rejects after timeoutMs with timeout error

- Helper: sendJSON(ws, data): void
  - ws.send(JSON.stringify(data))

- Helper: sleep(ms): Promise<void>

- Main test flow (async):

  Step 1: "Connect WebSocket"
  - Create ws = new WebSocket(WS_URL)
  - Wait for 'open' event (5s timeout)
  - PASS if connected

  Step 2: "Start Session"
  - sendJSON(ws, { type: "start_session", trajectoryId: "traj-jwt-auth-001", personas: ["architect", "detective"] })
  - Wait for message with type "session_started" (10s timeout)
  - Verify response has sessionId and personas array
  - Store sessionId for later steps
  - PASS if received

  Step 3: "Send Message"
  - sendJSON(ws, { type: "send_message", sessionId, message: "What are the key architectural decisions in this trajectory?", personas: ["architect", "detective"] })
  - PASS immediately (fire and forget from client side)

  Step 4: "Receive Agent Response"
  - Wait for message with type "agent_message" (30s timeout — agents take time to respond)
  - Verify response has from, content, timestamp
  - PASS if received with non-empty content

  Step 5: "Stop Session"
  - sendJSON(ws, { type: "stop_session", sessionId })
  - Sleep 2s
  - PASS

  Step 6: "Close Connection"
  - ws.close()
  - PASS

- Print results:
  - For each result: "[PASS]" or "[FAIL]" prefix + step name + error if failed
  - Print summary: "X/Y tests passed"
  - process.exit(0) if all passed, process.exit(1) if any failed

- Wrap everything in try/catch for unexpected errors

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/86-test-chat.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/86-test-chat.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/86-test-chat.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/test-chat.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/test-chat.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/test-chat.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/test-chat.ts && git commit -m "feat: add WebSocket chat integration test script"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("86-test-chat:", result.status);
