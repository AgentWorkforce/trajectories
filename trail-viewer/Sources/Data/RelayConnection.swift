//
//  RelayConnection.swift
//  Trail Viewer
//
//  Plain WebSocket connection to the local trail-viewer server's /ws endpoint.
//  Receives agent_message and typing events, populates @Observable properties
//  that ChatStore reads.
//

import Foundation
import Observation

// MARK: - ConnectionState

enum ConnectionState: String {
    case disconnected
    case connecting
    case connected
    case reconnecting
    case failed
}

// MARK: - RelayConnection

@Observable
final class RelayConnection {

    // MARK: - Public Properties

    private(set) var state: ConnectionState = .disconnected
    private(set) var messages: [ChatMessage] = []
    private(set) var typingPersonas: Set<String> = []

    // MARK: - Private Properties

    private let wsBaseURL: URL
    private var webSocketTask: URLSessionWebSocketTask?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 8
    private let baseReconnectDelay: TimeInterval = 1.0
    private var isIntentionalDisconnect = false

    // MARK: - Debug Logging

    private static let logFile: FileHandle? = {
        let path = "/tmp/trail-viewer-relay.log"
        FileManager.default.createFile(atPath: path, contents: nil)
        return FileHandle(forWritingAtPath: path)
    }()

    private func log(_ message: String) {
        let line = "[RelayConnection] \(message)\n"
        NSLog("%@", line)
        if let data = line.data(using: .utf8) {
            Self.logFile?.seekToEndOfFile()
            Self.logFile?.write(data)
        }
    }

    // MARK: - Init

    init(wsBaseURL: URL = AppConfiguration.wsBaseURL) {
        self.wsBaseURL = wsBaseURL
    }

    // MARK: - Connect

    func connect() {
        isIntentionalDisconnect = false
        reconnectAttempts = 0
        openWebSocket()
    }

    /// Connect with channel/apiKey parameters (ignored — kept for ChatStore compat).
    /// The plain WebSocket to /ws receives ALL broadcasts regardless of channel.
    func connect(channel: String, apiKey: String? = nil) {
        log("connect(channel=\(channel))")
        connect()
    }

    // MARK: - Disconnect

    func disconnect() {
        isIntentionalDisconnect = true
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        state = .disconnected
        typingPersonas = []
    }

    // MARK: - Send

    func send(sessionId: String, text: String, personas: [String]) {
        let payload: [String: Any] = [
            "type": "send_message",
            "sessionId": sessionId,
            "message": text,
            "personas": personas,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }

        webSocketTask?.send(.string(json)) { [weak self] error in
            if let error {
                self?.log("Send error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Clear

    func clearMessages() {
        messages = []
        typingPersonas = []
    }

    // MARK: - WebSocket Lifecycle

    private func openWebSocket() {
        state = .connecting

        var components = URLComponents(url: wsBaseURL, resolvingAgainstBaseURL: false)!
        switch components.scheme {
        case "http": components.scheme = "ws"
        case "https": components.scheme = "wss"
        default: break
        }
        components.path = "/ws"

        guard let url = components.url else {
            log("Invalid WebSocket URL")
            state = .failed
            return
        }

        log("Opening WebSocket to \(url)")
        let task = URLSession.shared.webSocketTask(with: url)
        self.webSocketTask = task
        task.resume()
        state = .connected
        reconnectAttempts = 0
        log("Connected")
        receiveNextMessage()
    }

    private func receiveNextMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleTextMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleTextMessage(text)
                    }
                @unknown default:
                    break
                }
                self.receiveNextMessage()
            case .failure(let error):
                if !self.isIntentionalDisconnect {
                    self.log("WebSocket error: \(error.localizedDescription)")
                    self.scheduleReconnect()
                }
            }
        }
    }

    private func scheduleReconnect() {
        guard !isIntentionalDisconnect else { return }
        guard reconnectAttempts < maxReconnectAttempts else {
            log("Max reconnect attempts reached")
            state = .failed
            return
        }

        state = .reconnecting
        reconnectAttempts += 1
        let delay = min(baseReconnectDelay * pow(2.0, Double(reconnectAttempts - 1)), 30.0)
        log("Reconnecting in \(delay)s (attempt \(reconnectAttempts))")

        Task {
            try? await Task.sleep(for: .seconds(delay))
            guard !self.isIntentionalDisconnect else { return }
            self.openWebSocket()
        }
    }

    // MARK: - Message Parsing

    private func handleTextMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = payload["type"] as? String else {
            return
        }

        Task { @MainActor in
            switch type {
            case "agent_message":
                self.handleAgentMessage(payload)
            case "typing":
                self.handleTypingEvent(payload)
            case "error":
                let message = payload["message"] as? String ?? "Unknown error"
                self.log("Server error: \(message)")
            default:
                break
            }
        }
    }

    private func handleAgentMessage(_ payload: [String: Any]) {
        let from = payload["from"] as? String ?? "agent"
        guard let content = payload["content"] as? String,
              !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        // Extract persona ID from persona object or from field
        let personaID: String?
        if let personaObj = payload["persona"] as? [String: Any] {
            personaID = personaObj["id"] as? String
        } else {
            personaID = nil
        }

        let timestamp: Date
        if let ts = payload["timestamp"] as? String {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            timestamp = formatter.date(from: ts) ?? Date()
        } else {
            timestamp = Date()
        }

        log("Agent message from=\(from) persona=\(personaID ?? "nil") content=\(content.prefix(60))")

        messages.append(ChatMessage(
            from: from,
            content: content,
            persona: personaID,
            timestamp: timestamp
        ))

        // Clear typing for this persona
        if let pid = personaID {
            typingPersonas.remove(pid)
        }
        typingPersonas.remove(from)
    }

    private func handleTypingEvent(_ payload: [String: Any]) {
        guard let persona = payload["persona"] as? String else { return }
        let isTyping = payload["isTyping"] as? Bool ?? true

        if isTyping {
            typingPersonas.insert(persona)
        } else {
            typingPersonas.remove(persona)
        }
    }
}
