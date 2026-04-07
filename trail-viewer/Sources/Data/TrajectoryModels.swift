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
    case unknown

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = TrajectoryEventType(rawValue: rawValue) ?? .unknown
    }
}

enum EventSignificance: String, Codable, Hashable {
    case high
    case medium
    case low
}

// MARK: - Task

struct TrajectoryTask: Codable, Hashable {
    let title: String
    let description: String?
}

// MARK: - AgentParticipation

struct AgentParticipation: Codable, Hashable {
    let name: String?
    let agentName: String?
    let role: String?
    let joinedAt: Date?
    let leftAt: Date?

    var displayName: String {
        name ?? agentName ?? "Unknown"
    }
}

// MARK: - TrajectoryEvent

struct TrajectoryEvent: Codable, Hashable, Identifiable {
    var id: String { "\(ts ?? 0)-\(type.rawValue)-\(content.prefix(20))" }
    let ts: Double?
    let type: TrajectoryEventType
    let content: String
    let agent: String?
    let significance: String?
    let metadata: [String: String]?

    var timestamp: Date? {
        guard let ts else { return nil }
        return Date(timeIntervalSince1970: ts / 1000)
    }

    enum CodingKeys: String, CodingKey {
        case ts, type, content, agent, significance, metadata
    }
}

// MARK: - Chapter

struct Chapter: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let agentName: String?
    let startedAt: Date?
    let endedAt: Date?
    let events: [TrajectoryEvent]
    let summary: String?

    // Accept both "number" and "agentName" / "agent" variants
    var number: Int? { nil }
}

// MARK: - Decision

struct Decision: Codable, Hashable, Identifiable {
    var id: String { "\(question.prefix(30))" }
    let question: String
    let chosen: String
    let alternatives: [String]?
    let confidence: Double?
    let reasoning: String?
}

// MARK: - Retrospective

struct Retrospective: Codable, Hashable {
    let summary: String
    let approach: String?
    let confidence: Double?
    let whatWentWell: [String]?
    let whatCouldImprove: [String]?
    let learnings: [String]?
}

// MARK: - Trajectory

struct Trajectory: Codable, Hashable, Identifiable {
    let id: String
    let version: Int?
    let task: TrajectoryTask
    let status: TrajectoryStatus
    let startedAt: Date?
    let completedAt: Date?
    let agents: [AgentParticipation]?
    let chapters: [Chapter]
    let retrospective: Retrospective?
    let commits: [String]?
    let filesChanged: [String]?
    let projectId: String?
    let tags: [String]?

    var title: String { task.title }
    var description: String? { task.description }
}

// MARK: - TrajectorySummary

struct TrajectorySummary: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let status: TrajectoryStatus
    let chapterCount: Int?
    let decisionCount: Int?
    let confidence: Double?
    let startedAt: Date?
    let completedAt: Date?
    let tags: [String]?
}
