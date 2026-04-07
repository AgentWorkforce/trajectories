import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Smoke test — single script with trap to guarantee server cleanup on failure.
 *
 * Combines start, health check, API check, and kill into one shell command
 * with `trap` so the server process is always cleaned up, even if a check fails.
 */
const result = await workflow("95-smoke-test-server")
  .description(
    "Smoke test: start server, verify health and API endpoints, then shut down",
  )
  .pattern("pipeline")
  .channel("wf-95-smoke-test")
  .timeout(300_000)

  .step("smoke-test", {
    type: "deterministic",
    command: `bash -c '
      set -e
      PID_FILE="/tmp/trail-viewer-smoke-pid"

      # Always clean up the server, even on failure
      cleanup() {
        if [ -f "$PID_FILE" ]; then
          kill "$(cat "$PID_FILE")" 2>/dev/null || true
          rm -f "$PID_FILE"
          echo "Server stopped"
        fi
      }
      trap cleanup EXIT

      # Start server in background
      cd trail-viewer/server
      npx tsx src/server.ts &
      echo $! > "$PID_FILE"

      # Wait for server to be ready (poll health endpoint, max 15s)
      for i in $(seq 1 30); do
        if curl -sf http://localhost:3847/health > /dev/null 2>&1; then
          echo "PASS: health check (attempt $i)"
          break
        fi
        if [ "$i" -eq 30 ]; then
          echo "FAIL: server did not start within 15s"
          exit 1
        fi
        sleep 0.5
      done

      # Check API endpoints
      curl -sf http://localhost:3847/api/trajectories > /dev/null && echo "PASS: GET /api/trajectories" || { echo "FAIL: GET /api/trajectories"; exit 1; }
      curl -sf http://localhost:3847/api/stats > /dev/null && echo "PASS: GET /api/stats" || { echo "FAIL: GET /api/stats"; exit 1; }
      curl -sf http://localhost:3847/api/personas > /dev/null && echo "PASS: GET /api/personas" || { echo "FAIL: GET /api/personas"; exit 1; }

      echo "All smoke tests passed"
    '`,
    failOnError: true,
  })

  .run({ cwd: process.cwd() });

console.log("95-smoke-test-server:", result.status);
