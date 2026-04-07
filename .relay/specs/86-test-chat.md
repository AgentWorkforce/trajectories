# test-chat.ts — Integration Test for Trail Viewer Chat WebSocket

```typescript
import WebSocket from "ws";

const WS_URL = process.env.WS_URL || "ws://localhost:3847/ws";

interface TestResult {
  step: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function waitForMessage(ws: WebSocket, type: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for message type "${type}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === type) {
          cleanup();
          resolve(msg);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off("message", handler);
    };

    ws.on("message", handler);
  });
}

function sendJSON(ws: WebSocket, data: unknown): void {
  ws.send(JSON.stringify(data));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let ws: WebSocket | null = null;
  let sessionId: string | undefined;

  try {
    // Step 1: Connect WebSocket
    try {
      ws = new WebSocket(WS_URL);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Connection timeout after 5000ms"));
        }, 5000);

        ws!.on("open", () => {
          clearTimeout(timer);
          resolve();
        });

        ws!.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      results.push({ step: "Connect WebSocket", passed: true });
    } catch (err: any) {
      results.push({ step: "Connect WebSocket", passed: false, error: err.message });
      printResults();
      return;
    }

    // Step 2: Start Session
    try {
      sendJSON(ws, {
        type: "start_session",
        trajectoryId: "traj-jwt-auth-001",
        personas: ["architect", "detective"],
      });
      const response = await waitForMessage(ws, "session_started", 10000);
      if (!response.sessionId) {
        throw new Error("Response missing sessionId");
      }
      if (!Array.isArray(response.personas)) {
        throw new Error("Response missing personas array");
      }
      sessionId = response.sessionId;
      results.push({ step: "Start Session", passed: true });
    } catch (err: any) {
      results.push({ step: "Start Session", passed: false, error: err.message });
      printResults();
      return;
    }

    // Step 3: Send Message
    try {
      sendJSON(ws, {
        type: "send_message",
        sessionId,
        message: "What are the key architectural decisions in this trajectory?",
        personas: ["architect", "detective"],
      });
      results.push({ step: "Send Message", passed: true });
    } catch (err: any) {
      results.push({ step: "Send Message", passed: false, error: err.message });
      printResults();
      return;
    }

    // Step 4: Receive Agent Response
    try {
      const response = await waitForMessage(ws, "agent_message", 30000);
      if (!response.from) {
        throw new Error("Response missing 'from' field");
      }
      if (!response.content || response.content.length === 0) {
        throw new Error("Response has empty content");
      }
      if (!response.timestamp) {
        throw new Error("Response missing 'timestamp' field");
      }
      results.push({ step: "Receive Agent Response", passed: true });
    } catch (err: any) {
      results.push({ step: "Receive Agent Response", passed: false, error: err.message });
      printResults();
      return;
    }

    // Step 5: Stop Session
    try {
      sendJSON(ws, {
        type: "stop_session",
        sessionId,
      });
      await sleep(2000);
      results.push({ step: "Stop Session", passed: true });
    } catch (err: any) {
      results.push({ step: "Stop Session", passed: false, error: err.message });
    }

    // Step 6: Close Connection
    try {
      ws.close();
      results.push({ step: "Close Connection", passed: true });
    } catch (err: any) {
      results.push({ step: "Close Connection", passed: false, error: err.message });
    }
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    results.push({ step: "Unexpected", passed: false, error: err.message });
  }

  printResults();
}

function printResults() {
  console.log("\n--- Test Results ---\n");
  for (const r of results) {
    const prefix = r.passed ? "[PASS]" : "[FAIL]";
    const errorSuffix = r.error ? ` — ${r.error}` : "";
    console.log(`${prefix} ${r.step}${errorSuffix}`);
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} tests passed`);

  if (passed === results.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
```

Run with:
```bash
npx tsx src/test-chat.ts
```

OWNER_DECISION: COMPLETE
REASON: Full test-chat.ts spec written to .relay/specs/86-test-chat.md with all 6 test steps, helpers, and result reporting as specified.
