import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("94-verify-typescript")
  .description("Verify server TypeScript compiles without errors")
  .pattern("pipeline")
  .channel("wf-94-verify-ts")
  .timeout(300_000)

  .step("typecheck", {
    type: "deterministic",
    command: "cd trail-viewer/server && npx tsc --noEmit 2>&1 | tail -20",
    failOnError: true,
  })

  .run({ cwd: process.cwd() });

console.log("94-verify-typescript:", result.status);
