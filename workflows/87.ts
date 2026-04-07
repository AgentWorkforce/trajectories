import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("87-launch-script")
  .description(
    "Create trail-viewer/launch.sh — shell script to build, start server, health check, and open app",
  )
  .pattern("pipeline")
  .channel("wf-87-launch-script")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Shell script architect for build and launch orchestration",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Shell script implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a shell script: launch.sh for the Trail Viewer app.

Requirements:
- Shebang: #!/usr/bin/env bash
- set -euo pipefail

- Parse flags:
  - --mock : Use mock trajectory data (set USE_MOCK=1)
  - --path <dir> : Set TRAJECTORIES_DATA_DIR to <dir>
  - --port <num> : Set PORT (default 3847)
  - --help : Print usage and exit

- Prerequisite checks:
  - Check node is installed (command -v node), print version, exit 1 if missing
  - Check npm is installed (command -v npm), exit 1 if missing

- Determine project root (SCRIPT_DIR from dirname of script, or use cd logic)

- Step 1: Build trajectories SDK
  - echo "Building trajectories SDK..."
  - cd to project root (two levels up from trail-viewer: ../../)
  - Run npm run build (if build script exists)
  - cd back

- Step 2: Install server dependencies
  - cd trail-viewer/server
  - If node_modules doesn't exist or package.json is newer, run npm install
  - cd back

- Step 3: Start server in background
  - Set environment variables: PORT, TRAJECTORIES_DATA_DIR (if --path given), USE_MOCK (if --mock)
  - cd trail-viewer/server
  - npx tsx src/server.ts &
  - SERVER_PID=$!
  - cd back

- Step 4: Health check loop
  - echo "Waiting for server..."
  - Loop up to 10 times (1 second sleep each):
    - curl -sf http://localhost:$PORT/health > /dev/null 2>&1 && break
    - If loop exhausted, echo "Server failed to start" and kill $SERVER_PID and exit 1
  - echo "Server ready at http://localhost:$PORT"

- Step 5: Open the app (macOS)
  - If trail-viewer/.build exists and has a binary: run the binary
  - Else if swift command exists: cd trail-viewer && swift run
  - Else: echo "Swift app not built. Server running at http://localhost:$PORT"

- Trap: trap cleanup SIGINT SIGTERM EXIT
  - cleanup function: kill $SERVER_PID if it's running, echo "Shutdown complete"

- Wait for server process: wait $SERVER_PID

Output the COMPLETE shell script ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/87-launch-script.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/87-launch-script.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/87-launch-script.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/launch.sh from this spec:

{{steps.read-spec.output}}

Extract the shell script and write it to trail-viewer/launch.sh.
Make sure the file is executable (chmod +x trail-viewer/launch.sh after writing).
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: { type: "file_exists", value: "trail-viewer/launch.sh" },
  })

  .step("make-executable", {
    type: "deterministic",
    dependsOn: ["implement"],
    command: "chmod +x trail-viewer/launch.sh",
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["make-executable"],
    command:
      'cd trail-viewer && git add launch.sh && git commit -m "feat: add launch.sh — build, start server, health check, and open app"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("87-launch-script:", result.status);
