import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("93-verify-swift-build")
  .description("Verify Swift project compiles successfully")
  .pattern("pipeline")
  .channel("wf-93-verify-swift")
  .timeout(300_000)

  .step("build", {
    type: "deterministic",
    command: "cd trail-viewer && swift build 2>&1 | tail -20",
    failOnError: true,
  })

  .run({ cwd: process.cwd() });

console.log("93-verify-swift-build:", result.status);
