import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("17-api-models")
  .description(
    "Create trail-viewer/Sources/Data/APIModels.swift — API response wrappers, error types, stats",
  )
  .pattern("pipeline")
  .channel("wf-17-api-models")
  .maxConcurrency(2)
  .timeout(900_000)

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
    task: `Output the COMPLETE contents of an APIModels.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation

2. TrajectoryStats (struct, Codable, Hashable):
   - total: Int
   - active: Int
   - completed: Int
   - abandoned: Int

   Static:
   - empty: TrajectoryStats (all zeros)

3. APIError (enum, Error, LocalizedError):
   Cases:
   - notFound(String) — resource not found
   - serverError(Int, String?) — HTTP status code + optional message
   - networkError(Error) — underlying network error
   - decodingError(Error) — JSON decoding error
   - invalidURL(String) — malformed URL
   - unauthorized — 401
   - unknown(String?) — catch-all

   Computed property errorDescription: String? for LocalizedError conformance.
   Make it Equatable by comparing case names (use custom == implementation that ignores associated Error values for networkError and decodingError).

4. StartChatResponse (struct, Codable):
   - sessionId: String
   - CodingKeys: session_id -> sessionId

5. APIResponse<T: Codable> (struct, Codable, generic):
   - data: T?
   - error: String?
   - success: Bool

6. PaginatedResponse<T: Codable> (struct, Codable):
   - data: [T]
   - total: Int
   - page: Int
   - pageSize: Int
   - CodingKeys: page_size -> pageSize

Output the full file contents ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/17-api-models.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/17-api-models.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/17-api-models.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Data/APIModels.swift from this spec:

{{steps.read-spec.output}}

Extract the APIModels.swift code and write it to trail-viewer/Sources/Data/APIModels.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/APIModels.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/APIModels.swift && git commit -m "feat: add APIModels.swift — API response wrappers, error types, stats"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("17-api-models:", result.status);
