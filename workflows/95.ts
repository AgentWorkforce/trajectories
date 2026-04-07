import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("95-smoke-test-server")
  .description(
    "Smoke test: start server, verify health and API endpoints, then shut down",
  )
  .pattern("pipeline")
  .channel("wf-95-smoke-test")
  .timeout(300_000)

  .step("start-server", {
    type: "deterministic",
    command:
      "cd trail-viewer/server && npx tsx src/server.ts & echo $! > /tmp/trail-viewer-smoke-pid && sleep 5",
    failOnError: true,
  })

  .step("health-check", {
    type: "deterministic",
    dependsOn: ["start-server"],
    command: "curl -sf http://localhost:3847/health",
    failOnError: true,
  })

  .step("api-check", {
    type: "deterministic",
    dependsOn: ["health-check"],
    command: "curl -sf http://localhost:3847/api/trajectories",
    failOnError: true,
  })

  .step("kill-server", {
    type: "deterministic",
    dependsOn: ["api-check"],
    command:
      "kill $(cat /tmp/trail-viewer-smoke-pid) 2>/dev/null; rm -f /tmp/trail-viewer-smoke-pid; echo 'Server stopped'",
    failOnError: false,
  })

  .run({ cwd: process.cwd() });

console.log("95-smoke-test-server:", result.status);
