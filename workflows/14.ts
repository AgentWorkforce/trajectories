import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("14-trajectory-models")
  .description(
    "Create trail-viewer/Sources/Data/TrajectoryModels.swift — Codable data models mirroring TypeScript types",
  )
  .pattern("pipeline")
  .channel("wf-14-trajectory-models")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift data model architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a TrajectoryModels.swift file for the Trail Viewer macOS app.

These models mirror the TypeScript trajectory SDK types. All must be Codable, Identifiable where they have an id, and Hashable.

Requirements:

1. Import Foundation

2. Enums (String, Codable, Hashable):

   TrajectoryStatus: active, completed, abandoned

   TrajectoryEventType: note, finding, thinking, toolCall, toolResult, reflection, error, messageSent, messageReceived, decision, codeChange, fileCreate, fileModify, checkpoint

   EventSignificance: high, medium, low

   AgentRole: lead, worker, reviewer, analyst, coordinator

   TaskSourceSystem: github, linear, jira, manual, other

3. Structs (Codable, Hashable, and Identifiable where they have an id field):

   TaskSource:
   - system: TaskSourceSystem
   - identifier: String
   - url: String?
   - title: String?

   TaskReference:
   - source: TaskSource
   - description: String?

   AgentParticipation:
   - agentName: String
   - role: AgentRole
   - joinedAt: Date
   - leftAt: Date?
   - eventsCount: Int?

   Alternative (for decisions):
   - option: String
   - prosOrCons: String? (JSON key "pros_cons")
   - rejected: Bool?

   Decision:
   - id: String
   - question: String
   - chosen: String
   - alternatives: [Alternative]?
   - confidence: Double?
   - reasoning: String?
   - timestamp: Date

   Retrospective:
   - summary: String
   - whatWentWell: [String]?
   - whatCouldImprove: [String]?
   - approach: String?
   - learnings: [String]?
   - timestamp: Date?

   TrajectoryEvent:
   - id: String
   - type: TrajectoryEventType
   - timestamp: Date
   - agent: String?
   - content: String
   - significance: EventSignificance?
   - metadata: [String: String]? (use AnyCodable or just String dict)
   - chapterId: String?

   Chapter:
   - id: String
   - title: String
   - number: Int
   - agent: String?
   - startedAt: Date
   - completedAt: Date?
   - events: [TrajectoryEvent]
   - summary: String?

   Trajectory:
   - id: String
   - title: String
   - description: String?
   - status: TrajectoryStatus
   - taskReference: TaskReference?
   - chapters: [Chapter]
   - decisions: [Decision]?
   - retrospective: Retrospective?
   - agents: [AgentParticipation]?
   - tags: [String]?
   - createdAt: Date
   - updatedAt: Date
   - completedAt: Date?
   - filesChanged: [String]?
   - commits: [String]?

   TrajectorySummary (lightweight for list views):
   - id: String
   - title: String
   - status: TrajectoryStatus
   - chapterCount: Int
   - eventCount: Int
   - agents: [String]
   - tags: [String]?
   - createdAt: Date
   - updatedAt: Date

4. All structs use CodingKeys enum to map from snake_case JSON keys to camelCase Swift properties (e.g., created_at -> createdAt, what_went_well -> whatWentWell, etc.)

5. Use JSONDecoder.DateDecodingStrategy.iso8601 compatible dates.

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/14-trajectory-models.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/14-trajectory-models.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/14-trajectory-models.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Data/TrajectoryModels.swift from this spec:

{{steps.read-spec.output}}

Extract the TrajectoryModels.swift code and write it to trail-viewer/Sources/Data/TrajectoryModels.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/TrajectoryModels.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/TrajectoryModels.swift && git commit -m "feat: add TrajectoryModels.swift — Codable models for trajectories, chapters, events"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("14-trajectory-models:", result.status);
