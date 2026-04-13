# ChatModels.swift — Complete File Contents

```swift
import Foundation
import SwiftUI

// MARK: - ChatSessionState

enum ChatSessionState: String, Codable, Hashable {
    case idle
    case connecting
    case active
    case disconnected
    case error
}

// MARK: - TypingState

enum TypingState: String, Codable, Hashable {
    case idle
    case typing
    case thinking
}

// MARK: - ChatPersona

struct ChatPersona: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let emoji: String
    let description: String
    let colorHex: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case emoji
        case description
        case colorHex = "color_hex"
    }

    var color: Color {
        Color(hex: colorHex)
    }
}

// MARK: - ChatMessage

struct ChatMessage: Codable, Identifiable, Hashable {
    let id: UUID
    let from: String
    let content: String
    let persona: String?
    let timestamp: Date

    init(
        id: UUID = UUID(),
        from: String,
        content: String,
        persona: String? = nil,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.from = from
        self.content = content
        self.persona = persona
        self.timestamp = timestamp
    }

    enum CodingKeys: String, CodingKey {
        case id
        case from
        case content
        case persona
        case timestamp
    }

    var isUser: Bool {
        from == "user"
    }

    var isSystem: Bool {
        from == "system"
    }
}

// MARK: - ChatWebSocketMessage

struct ChatWebSocketMessage: Codable {
    let type: String
    let sessionId: String?
    let from: String?
    let content: String?
    let persona: String?

    enum CodingKeys: String, CodingKey {
        case type
        case sessionId = "session_id"
        case from
        case content
        case persona
    }
}
```
