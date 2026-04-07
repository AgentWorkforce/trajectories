import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("85-mock-trajectories")
  .description(
    "Create trail-viewer/server/src/mock-trajectories.ts — 3 realistic sample trajectories and MockTrajectoryService",
  )
  .pattern("pipeline")
  .channel("wf-85-mock-trajectories")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for test data generation",
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
    task: `Output the COMPLETE contents of a TypeScript file: mock-trajectories.ts for the Trail Viewer server.

Requirements:
- Import relevant types from 'agent-trajectories/sdk' or define inline: Trajectory, TrajectoryStatus, TrajectorySummary, Chapter, TrajectoryEvent, Decision, Retrospective, Agent

- Create 3 realistic mock trajectory objects:

1. COMPLETED trajectory — "Implement JWT Authentication":
   - id: "traj-jwt-auth-001"
   - status: "completed"
   - tags: ["auth", "security"]
   - 2 agents: { name: "lead-claude", role: "Lead Architect" }, { name: "impl-codex", role: "Implementer" }
   - 3 chapters:
     a) "Research & Planning" — 3 events (research existing auth, design JWT flow, select libraries)
     b) "Implementation" — 4 events (create auth middleware, implement token generation, add refresh tokens, write user model)
     c) "Testing & Deployment" — 3 events (write unit tests, integration tests, deploy to staging)
   - 2 decisions:
     a) Question: "Which JWT library to use?", Chosen: "jose", Reasoning: "Standard compliant, actively maintained, good TypeScript support", Alternatives: ["jsonwebtoken", "fast-jwt"]
     b) Question: "Token storage strategy?", Chosen: "HTTP-only cookies", Reasoning: "More secure than localStorage, prevents XSS attacks", Alternatives: ["localStorage", "sessionStorage"]
   - Full retrospective: summary, lessonsLearned (3 items), recommendations (2 items)

2. ACTIVE trajectory — "Refactor Payment Pipeline":
   - id: "traj-payment-refactor-002"
   - status: "active"
   - tags: ["payments", "refactoring", "backend"]
   - 2 agents
   - 2 chapters:
     a) "Analysis" — 3 events
     b) "Refactoring" — 3 events (in progress)
   - 1 decision: "Which payment processor abstraction pattern?", Chosen: "Strategy pattern", Alternatives: ["Adapter pattern", "Factory pattern"]
   - No retrospective (still active)

3. ABANDONED trajectory — "Migrate to GraphQL":
   - id: "traj-graphql-migration-003"
   - status: "abandoned"
   - tags: ["graphql", "api", "migration"]
   - 1 agent
   - 1 chapter: "Exploration" — 3 events (including an error event with type "error")
   - No decisions
   - Brief retrospective: summary explaining why abandoned (complexity too high for current team size, REST API working well enough)

- Export const MOCK_TRAJECTORIES: Trajectory[] = [all three]

- Export class MockTrajectoryService (implementing same interface as TrajectoryService):
  - Private trajectories = MOCK_TRAJECTORIES
  - async init(): void (no-op)
  - async listTrajectories(query?): TrajectorySummary[] — same filtering logic as TrajectoryService
  - async getTrajectory(id): Trajectory | null
  - async searchTrajectories(text): TrajectorySummary[]
  - async getTrajectoryMarkdown(id): string — basic markdown output
  - async getTrajectoryTimeline(id): string — basic timeline output
  - async getStats(): { total, active, completed, abandoned }

- Give each trajectory realistic dates (createdAt, updatedAt) using new Date() offsets
- Events should have timestamps, descriptions, significance scores (1-5), and agent references

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "MockTrajectoryService" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/mock-trajectories.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/mock-trajectories.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/mock-trajectories.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/mock-trajectories.ts && git commit -m "feat: add mock trajectories — 3 realistic samples and MockTrajectoryService"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("85-mock-trajectories:", result.status);
