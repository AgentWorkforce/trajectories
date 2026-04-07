import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("18-api-client")
  .description(
    "Create trail-viewer/Sources/Data/APIClient.swift — async HTTP client with all REST endpoints",
  )
  .pattern("pipeline")
  .channel("wf-18-api-client")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift networking architect",
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
    task: `Output the COMPLETE contents of an APIClient.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation

2. Define actor APIClient:
   - Private property: baseURL: URL (from AppConfiguration.serverBaseURL)
   - Private property: session: URLSession (default .shared)
   - Private property: decoder: JSONDecoder configured with:
     - .keyDecodingStrategy = .convertFromSnakeCase
     - .dateDecodingStrategy = .iso8601

3. Initializer: init(baseURL: URL = AppConfiguration.serverBaseURL)

4. Private helper methods:
   - request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Encodable? = nil, queryItems: [URLQueryItem]? = nil) async throws -> T
     - Constructs URL from baseURL + endpoint
     - Adds query items if provided
     - Sets Content-Type header to application/json
     - Encodes body if provided (with .convertToSnakeCase key strategy)
     - Makes URLSession request
     - Checks HTTP status code (throw APIError for non-2xx)
     - Decodes response with decoder
     - Maps errors to APIError cases

5. Public methods:

   Trajectories:
   - listTrajectories(status: TrajectoryStatus? = nil, search: String? = nil, tags: [String]? = nil) async throws -> [TrajectorySummary]
     - GET /api/trajectories with optional query params
   - getTrajectory(id: String) async throws -> Trajectory
     - GET /api/trajectories/:id
   - getTrajectoryMarkdown(id: String) async throws -> String
     - GET /api/trajectories/:id/markdown (returns raw string, not JSON)
   - getTrajectoryTimeline(id: String) async throws -> String
     - GET /api/trajectories/:id/timeline (returns raw string)

   Stats:
   - getStats() async throws -> TrajectoryStats
     - GET /api/stats

   Chat:
   - getPersonas() async throws -> [ChatPersona]
     - GET /api/chat/personas
   - startChatSession(trajectoryId: String, personas: [String], preferredCLI: String? = nil) async throws -> StartChatResponse
     - POST /api/chat/start with JSON body
   - sendChatMessage(sessionId: String, message: String, personas: [String]) async throws -> Void
     - POST /api/chat/message with JSON body
   - stopChatSession(sessionId: String) async throws -> Void
     - POST /api/chat/stop with JSON body

6. For the markdown/timeline endpoints that return raw text, use a separate method that returns String instead of decoding JSON.

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "APIClient" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/APIClient.swift from this spec:

{{steps.plan.output}}

Extract the APIClient.swift code and write it to trail-viewer/Sources/Data/APIClient.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/APIClient.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/APIClient.swift && git commit -m "feat: add APIClient.swift — async HTTP client for all REST endpoints"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("18-api-client:", result.status);
