# TrajectoryModels.swift — Complete File

```swift
import Foundation

// MARK: - Enums

enum TrajectoryStatus: String, Codable, Hashable {
    case active
    case completed
    case abandoned
}

enum TrajectoryEventType: String, Codable, Hashable {
    case note
    case finding
    case thinking
    case toolCall = "tool_call"
    case toolResult = "tool_result"
    case reflection
    case error
    case messageSent = "message_sent"
    case messageReceived = "message_received"
    case decision
    case codeChange = "code_change"
    case fileCreate = "file_create"
    case fileModify = "file_modify"
    case checkpoint
}

enum EventSignificance: String, Codable, Hashable {
    case high
    case medium
    case low
}

enum AgentRole: String, Codable, Hashable {
    case lead
    case worker
    case reviewer
    case analyst
    case coordinator
}

enum TaskSourceSystem: String, Codable, Hashable {
    case github
    case linear
    case jira
    case manual
    case other
}

// MARK: - TaskSource

struct TaskSource: Codable, Hashable {
    let system: TaskSourceSystem
    let identifier: String
    let url: String?
    let title: String?
}

// MARK: - TaskReference

struct TaskReference: Codable, Hashable {
    let source: TaskSource
    let description: String?
}

// MARK: - AgentParticipation

struct AgentParticipation: Codable, Hashable {
    let agentName: String
    let role: AgentRole
    let joinedAt: Date
    let leftAt: Date?
    let eventsCount: Int?

    enum CodingKeys: String, CodingKey {
        case agentName = "agent_name"
        case role
        case joinedAt = "joined_at"
        case leftAt = "left_at"
        case eventsCount = "events_count"
    }
}

// MARK: - Alternative

struct Alternative: Codable, Hashable {
    let option: String
    let prosOrCons: String?
    let rejected: Bool?

    enum CodingKeys: String, CodingKey {
        case option
        case prosOrCons = "pros_cons"
        case rejected
    }
}

// MARK: - Decision

struct Decision: Codable, Hashable, Identifiable {
    let id: String
    let question: String
    let chosen: String
    let alternatives: [Alternative]?
    let confidence: Double?
    let reasoning: String?
    let timestamp: Date
}

// MARK: - Retrospective

struct Retrospective: Codable, Hashable {
    let summary: String
    let whatWentWell: [String]?
    let whatCouldImprove: [String]?
    let approach: String?
    let learnings: [String]?
    let timestamp: Date?

    enum CodingKeys: String, CodingKey {
        case summary
        case whatWentWell = "what_went_well"
        case whatCouldImprove = "what_could_improve"
        case approach
        case learnings
        case timestamp
    }
}

// MARK: - TrajectoryEvent

struct TrajectoryEvent: Codable, Hashable, Identifiable {
    let id: String
    let type: TrajectoryEventType
    let timestamp: Date
    let agent: String?
    let content: String
    let significance: EventSignificance?
    let metadata: [String: String]?
    let chapterId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case timestamp
        case agent
        case content
        case significance
        case metadata
        case chapterId = "chapter_id"
    }
}

// MARK: - Chapter

struct Chapter: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let number: Int
    let agent: String?
    let startedAt: Date
    let completedAt: Date?
    let events: [TrajectoryEvent]
    let summary: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case number
        case agent
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case events
        case summary
    }
}

// MARK: - Trajectory

struct Trajectory: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: TrajectoryStatus
    let taskReference: TaskReference?
    let chapters:  hapter]
    let decisions: [Decision]?
    let retrospective: Retrospective?
    let agents: [AgentParticipation]?
    let tags: [String]?
    let createdAt: Date
    let updatedAt: Date
    let completedAt: Date?
    let filesChanged: [String]?
    let commits: [String]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case status
        case taskReference = "task_reference"
        case chapters
        case decisions
        case retrospective
        case agents
        case tags
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case completedAt = "completed_at"
        case filesChanged = "files_changed"
        case commits
    }
}

// MARK: - TrajectorySummary

struct TrajectorySummary: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let status: TrajectoryStatus
    let chapterCount: Int
    let eventCount: Int
    let agents: [String]
    let tags: [String]?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case status
        case chapterCount = "chapter_count"
        case eventCount = "event_count"
        case agents
        case tags
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
```

## Notes

- All enums use `String` raw values matching the snake_case JSON keys.
- All structs with an `id` field conform to `Identifiable`.
- All structs conform to `Codable` and `Hashable`.
- `CodingKeys` enums map snake_case JSON to camelCase Swift properties. Structs where all property names already match JSON keys (TaskSource, TaskReference, Decision) omit CodingKeys since the keys are identical.
- `metadata` on `TrajectoryEvent` uses `[String: String]` for simplicity — no AnyCodable dependency needed.
- `Alternative.prosOrCons` maps to JSON key `"pros_cons"`.
- Dates should be decoded with `JSONDecoder.DateDecodingStrategy.iso8601`.
- `TrajectoryEventType` raw values use snake_case to match JSON (e.g., `toolCall = "tool_call"`).
