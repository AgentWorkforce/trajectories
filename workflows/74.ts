import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("74-trajectory-formatter")
  .description(
    "Create trail-viewer/server/src/trajectory-formatter.ts — rich markdown formatting for agent context",
  )
  .pattern("pipeline")
  .channel("wf-74-trajectory-formatter")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for trajectory formatting",
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
    task: `Output the COMPLETE contents of a TypeScript file: trajectory-formatter.ts for the Trail Viewer server.

Requirements:
- Import Trajectory type from 'agent-trajectories/sdk' (or define inline if needed)
- Assume Trajectory has: id, title, status, agents[], chapters[] (each with events[]), decisions[] (each with question, chosen, reasoning, alternatives[]), retrospective (with summary, lessonsLearned[], recommendations[])

- Export function formatTrajectoryForAgent(trajectory: Trajectory): string
  - Returns a structured markdown document suitable for injecting into an agent's context
  - Sections:
    1. Title header (# trajectory.title)
    2. Status badge and metadata (status, created, last updated, duration if available)
    3. Agents involved (list with roles)
    4. Chapters — for each chapter:
       - Chapter title as ## heading
       - Only KEY events (skip events with significance < 3 or similar low-importance filter)
       - Each event: bullet with timestamp, description, agent
    5. Decisions — for each decision:
       - Question posed
       - Chosen option (highlighted)
       - Reasoning
       - Alternatives considered (as sub-bullets)
    6. Retrospective (if present):
       - Summary paragraph
       - Lessons learned (bulleted)
       - Recommendations (bulleted)
  - Use clean markdown formatting with headers, bullets, bold for emphasis

- Export function formatTrajectoryBrief(trajectory: Trajectory): string
  - Short version, approximately 500 tokens
  - Include: title, status, key decisions (question + chosen only), retrospective summary
  - Skip chapters, events, alternatives, detailed reasoning
  - Suitable for quick context injection

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: {
      type: "output_contains",
      value: "formatTrajectoryForAgent",
    },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/trajectory-formatter.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/trajectory-formatter.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/trajectory-formatter.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/trajectory-formatter.ts && git commit -m "feat: add trajectory formatter — rich markdown and brief formats for agent context"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("74-trajectory-formatter:", result.status);
