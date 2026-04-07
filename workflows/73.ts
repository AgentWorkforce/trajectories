import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("73-trajectory-service")
  .description(
    "Create trail-viewer/server/src/trajectory-service.ts — server-side TrajectoryClient wrapper",
  )
  .pattern("pipeline")
  .channel("wf-73-trajectory-service")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for trajectory data access",
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
    task: `Output the COMPLETE contents of a TypeScript file: trajectory-service.ts for the Trail Viewer server.

Requirements:
- Import TrajectoryClient from 'agent-trajectories/sdk' (the SDK for reading trajectory data)
- Import relevant types: Trajectory, TrajectorySummary, TrajectoryStatus from 'agent-trajectories/sdk'
- Read TRAJECTORIES_DATA_DIR from process.env, default to a sensible path like '../../data'

- Define and export class TrajectoryService:
  - Private field: client: TrajectoryClient
  - Private field: dataDir: string

  - constructor(dataDir?: string):
    - Use dataDir param or process.env.TRAJECTORIES_DATA_DIR or default '../../data'
    - Create TrajectoryClient with { dataDir: this.dataDir, autoSave: false } (read-only)

  - async init(): Promise<void>
    - Initialize the client (call client.init() if it exists, or just verify data dir is accessible)

  - async listTrajectories(query?: { status?: TrajectoryStatus; search?: string; tags?: string[] }): Promise<TrajectorySummary[]>
    - Get all trajectories from client
    - Filter by status if query.status provided
    - Filter by search text (match against title, description) if query.search provided
    - Filter by tags (trajectory must have ALL specified tags) if query.tags provided
    - Return as TrajectorySummary[] (id, title, status, tags, createdAt, updatedAt)

  - async getTrajectory(id: string): Promise<Trajectory | null>
    - Fetch single trajectory by ID from client
    - Return null if not found

  - async searchTrajectories(text: string): Promise<TrajectorySummary[]>
    - Search across trajectory titles, descriptions, chapter names, event descriptions
    - Case-insensitive matching
    - Return matching summaries

  - async getTrajectoryMarkdown(id: string): Promise<string>
    - Get trajectory, format as markdown document
    - Include title, status, metadata, chapters with events, decisions, retrospective
    - Return empty string if not found

  - async getTrajectoryTimeline(id: string): Promise<string>
    - Get trajectory, format as chronological timeline
    - Each event: timestamp - chapter - event description
    - Return empty string if not found

  - async getStats(): Promise<{ total: number; active: number; completed: number; abandoned: number }>
    - Count trajectories by status
    - Return totals

- Export the class as default and named export

Output the COMPLETE TypeScript file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/73-trajectory-service.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/73-trajectory-service.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/73-trajectory-service.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/server/src/trajectory-service.ts from this spec:

{{steps.read-spec.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/trajectory-service.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/trajectory-service.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/trajectory-service.ts && git commit -m "feat: add TrajectoryService — server-side read-only trajectory data access"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("73-trajectory-service:", result.status);
