//
//  RelayConnection.swift
//  Trail Viewer
//
//  Native @Observable wrapper around the local RelayBridge WebSocket.
//  Keeps the chat-facing surface area stable for ChatStore while managing
//  connection lifecycle, event decoding, and reconnect behavior directly.
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

    private(set) var state: ConnectionState {
        get {
            access(keyPath: \.state)
            return stateSnapshot()
        }
        set {
            setStateValue(newValue)
        }
    }

    private(set) var messages: [ChatMessage] {
        get {
            access(keyPath: \.messages)
            return messagesSnapshot()
        }
        set {
            replaceMessages(with: newValue)
        }
    }

    private(set) var typingPersonas: Set<String> {
        get {
            access(keyPath: \.typingPersonas)
            return typingPersonasSnapshot()
        }
        set {
            replaceTypingPersonas(with: newValue)
        }
    }

    // MARK: - Private Properties

    private let wsBaseURL: URL
    private let maxReconnectAttempts: Int
    private let baseReconnectDelay: TimeInterval
    private let maxReconnectDelay: TimeInterval

    @ObservationIgnored private let session: URLSession
    @ObservationIgnored private let decoder = JSONDecoder()
    @ObservationIgnored private let encoder = JSONEncoder()
    @ObservationIgnored private let stateLock = NSLock()
    @ObservationIgnored private let socketQueue = DispatchQueue(label: "TrailViewer.RelayConnection")
    @ObservationIgnored private let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
    @ObservationIgnored private let fractionalSecondsFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    @ObservationIgnored private var _state: ConnectionState = .disconnected
    @ObservationIgnored private var _messages: [ChatMessage] = []
    @ObservationIgnored private var _typingPersonas: Set<String> = []

    @ObservationIgnored private var webSocketTask: URLSessionWebSocketTask?
    @ObservationIgnored private var reconnectTask: Task<Void, Never>?
    @ObservationIgnored private var reconnectAttempts = 0
    @ObservationIgnored private var isIntentionalDisconnect = false
    @ObservationIgnored private var pendingOutboundMessages: [String] = []
    @ObservationIgnored private var isFlushingOutboundMessages = false

    // MARK: - Init

    init(
        wsBaseURL: URL = AppConfiguration.wsBaseURL,
        maxReconnectAttempts: Int = 8,
        baseReconnectDelay: TimeInterval = 1.0,
        fallbackChannel: String = "chat"
    ) {
        self.wsBaseURL = wsBaseURL
        self.maxReconnectAttempts = maxReconnectAttempts
        self.baseReconnectDelay = baseReconnectDelay
        self.maxReconnectDelay = 30.0
        self.session = URLSession(configuration: .default)

        // Retained for initializer compatibility; the local WebSocket server
        // does not use SDK-style channel subscriptions.
        _ = fallbackChannel
    }

    deinit {
        reconnectTask?.cancel()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        session.invalidateAndCancel()
    }

    // MARK: - Connect

    func connect() {
        socketQueue.async { [weak self] in
            guard let self else { return }

            isIntentionalDisconnect = false
            reconnectTask?.cancel()
            reconnectTask = nil

            if let task = webSocketTask {
                let currentState = stateSnapshot()
                if currentState == .connected || currentState == .connecting || currentState == .reconnecting {
                    return
                }

                task.cancel(with: .goingAway, reason: nil)
                webSocketTask = nil
            }

            reconnectAttempts = 0
            openWebSocket(isReconnect: false)
        }
    }

    // MARK: - Disconnect

    func disconnect() {
        socketQueue.async { [weak self] in
            guard let self else { return }

            isIntentionalDisconnect = true
            reconnectTask?.cancel()
            reconnectTask = nil
            pendingOutboundMessages = []
            isFlushingOutboundMessages = false

            if let task = webSocketTask {
                task.cancel(with: .normalClosure, reason: nil)
                webSocketTask = nil
            }

            clearTypingIndicators()
            setStateValue(.disconnected)
        }
    }

    // MARK: - Send

    func send(sessionId: String, text: String, personas: [String]) {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }

        let payload = SendMessagePayload(
            type: "send_message",
            sessionId: sessionId,
            message: trimmedText,
            personas: personas
        )

        guard let encodedMessage = encode(payload) else { return }

        socketQueue.async { [weak self] in
            guard let self else { return }

            isIntentionalDisconnect = false
            pendingOutboundMessages.append(encodedMessage)

            let currentState = stateSnapshot()
            if currentState == .failed || currentState == .disconnected {
                reconnectTask?.cancel()
                reconnectTask = nil

                if let task = webSocketTask {
                    task.cancel(with: .goingAway, reason: nil)
                    webSocketTask = nil
                }

                reconnectAttempts = 0
                openWebSocket(isReconnect: false)
                return
            }

            if webSocketTask == nil {
                reconnectTask?.cancel()
                reconnectTask = nil
                openWebSocket(isReconnect: false)
                return
            }

            flushPendingMessagesIfPossible()
        }
    }

    // MARK: - Clear

    func clearMessages() {
        replaceMessages(with: [])
        replaceTypingPersonas(with: [])
    }

    // MARK: - Socket Helpers

    private func openWebSocket(isReconnect: Bool) {
        guard webSocketTask == nil else {
            flushPendingMessagesIfPossible()
            return
        }

        setStateValue(isReconnect ? .reconnecting : .connecting)

        let task = session.webSocketTask(with: webSocketURL(path: "/ws"))
        webSocketTask = task
        task.resume()

        receiveNextMessage(on: task)
        verifyConnection(on: task)
    }

    private func verifyConnection(on task: URLSessionWebSocketTask) {
        task.sendPing { [weak self, weak task] error in
            guard let self, let task else { return }

            socketQueue.async {
                guard task === self.webSocketTask else { return }

                if let error {
                    self.handleSocketFailure(error, from: task)
                    return
                }

                self.markConnected()
            }
        }
    }

    private func receiveNextMessage(on task: URLSessionWebSocketTask) {
        task.receive { [weak self, weak task] result in
            guard let self, let task else { return }

            socketQueue.async {
                guard task === self.webSocketTask else { return }

                switch result {
                case .success(let message):
                    self.handleIncomingMessage(message)
                    self.receiveNextMessage(on: task)

                case .failure(let error):
                    self.handleSocketFailure(error, from: task)
                }
            }
        }
    }

    private func handleIncomingMessage(_ message: URLSessionWebSocketTask.Message) {
        markConnected()

        switch message {
        case .data(let data):
            handleIncomingData(data)

        case .string(let text):
            guard let data = text.data(using: .utf8) else {
                print("[RelayConnection] Received non-UTF8 text frame")
                return
            }

            handleIncomingData(data)

        @unknown default:
            break
        }
    }

    private func handleIncomingData(_ data: Data) {
        do {
            let envelope = try decoder.decode(ServerEventEnvelope.self, from: data)

            switch envelope.type {
            case "agent_message":
                let event = try decoder.decode(AgentMessageEvent.self, from: data)
                appendMessage(
                    from: event.persona?.id ?? event.from,
                    content: event.content,
                    persona: event.persona?.id,
                    timestamp: event.timestamp
                )

            case "typing":
                let event = try decoder.decode(TypingEvent.self, from: data)
                updateTypingPersona(event.persona, isTyping: event.isTyping)

            case "session_started":
                _ = try? decoder.decode(SessionStartedEvent.self, from: data)

            case "error":
                let event = try decoder.decode(ServerErrorEvent.self, from: data)
                if let code = event.code, !code.isEmpty {
                    print("[RelayConnection] Relay error (\(code)): \(event.message)")
                } else {
                    print("[RelayConnection] Relay error: \(event.message)")
                }

            default:
                break
            }
        } catch {
            let rawMessage = String(data: data, encoding: .utf8) ?? "<binary>"
            print("[RelayConnection] Failed to decode WebSocket event: \(error.localizedDescription). Payload: \(rawMessage)")
        }
    }

    private func handleSocketFailure(_ error: Error, from task: URLSessionWebSocketTask) {
        guard task === webSocketTask else { return }

        webSocketTask = nil
        isFlushingOutboundMessages = false
        clearTypingIndicators()

        if isIntentionalDisconnect {
            setStateValue(.disconnected)
            return
        }

        guard reconnectAttempts < maxReconnectAttempts else {
            setStateValue(.failed)
            print("[RelayConnection] WebSocket failed after \(maxReconnectAttempts) attempts: \(error.localizedDescription)")
            return
        }

        reconnectAttempts += 1
        let backoffMultiplier = Double(1 << max(reconnectAttempts - 1, 0))
        let delay = min(baseReconnectDelay * backoffMultiplier, maxReconnectDelay)

        setStateValue(.reconnecting)
        print(
            "[RelayConnection] WebSocket disconnected: \(error.localizedDescription). " +
            "Reconnecting in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))."
        )

        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            let delayNanoseconds = UInt64(delay * 1_000_000_000)
            try? await Task.sleep(nanoseconds: delayNanoseconds)
            guard !Task.isCancelled else { return }

            self?.socketQueue.async { [weak self] in
                guard let self else { return }
                guard !isIntentionalDisconnect else { return }
                guard webSocketTask == nil else { return }

                openWebSocket(isReconnect: true)
            }
        }
    }

    private func flushPendingMessagesIfPossible() {
        guard !isFlushingOutboundMessages else { return }
        guard stateSnapshot() == .connected else { return }
        guard let task = webSocketTask, !pendingOutboundMessages.isEmpty else { return }

        isFlushingOutboundMessages = true
        let payload = pendingOutboundMessages.removeFirst()

        task.send(.string(payload)) { [weak self, weak task] error in
            guard let self, let task else { return }

            socketQueue.async {
                self.isFlushingOutboundMessages = false

                if let error {
                    self.pendingOutboundMessages.insert(payload, at: 0)

                    if task === self.webSocketTask {
                        self.handleSocketFailure(error, from: task)
                    }

                    return
                }

                if task === self.webSocketTask {
                    self.markConnected()
                }

                self.flushPendingMessagesIfPossible()
            }
        }
    }

    private func markConnected() {
        reconnectAttempts = 0
        if stateSnapshot() != .connected {
            setStateValue(.connected)
        }
        flushPendingMessagesIfPossible()
    }

    private func webSocketURL(path: String) -> URL {
        var components = URLComponents(url: wsBaseURL, resolvingAgainstBaseURL: false)!

        switch components.scheme {
        case "http":
            components.scheme = "ws"
        case "https":
            components.scheme = "wss"
        default:
            break
        }

        components.path = path
        return components.url!
    }

    // MARK: - Message Helpers

    private func encode(_ payload: SendMessagePayload) -> String? {
        do {
            let data = try encoder.encode(payload)
            return String(data: data, encoding: .utf8)
        } catch {
            print("[RelayConnection] Failed to encode outbound message: \(error.localizedDescription)")
            return nil
        }
    }

    private func appendMessage(
        from sender: String?,
        content: String,
        persona: String?,
        timestamp: String
    ) {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        var updatedMessages = messagesSnapshot()
        updatedMessages.append(
            ChatMessage(
                from: sender ?? "agent",
                content: content,
                persona: persona,
                timestamp: parsedDate(from: timestamp) ?? Date()
            )
        )
        replaceMessages(with: updatedMessages)
    }

    private func updateTypingPersona(_ personaID: String, isTyping: Bool) {
        var updatedTypingPersonas = typingPersonasSnapshot()
        if isTyping {
            updatedTypingPersonas.insert(personaID)
        } else {
            updatedTypingPersonas.remove(personaID)
        }
        replaceTypingPersonas(with: updatedTypingPersonas)
    }

    private func clearTypingIndicators() {
        replaceTypingPersonas(with: [])
    }

    private func parsedDate(from timestamp: String?) -> Date? {
        guard let timestamp else { return nil }
        if let date = fractionalSecondsFormatter.date(from: timestamp) {
            return date
        }
        return iso8601Formatter.date(from: timestamp)
    }

    // MARK: - Snapshot Helpers

    private func stateSnapshot() -> ConnectionState {
        withStateLock { _state }
    }

    private func messagesSnapshot() -> [ChatMessage] {
        withStateLock { _messages }
    }

    private func typingPersonasSnapshot() -> Set<String> {
        withStateLock { _typingPersonas }
    }

    private func setStateValue(_ newValue: ConnectionState) {
        withMutation(keyPath: \.state) {
            withStateLock {
                _state = newValue
            }
        }
    }

    private func replaceMessages(with newValue: [ChatMessage]) {
        withMutation(keyPath: \.messages) {
            withStateLock {
                _messages = newValue
            }
        }
    }

    private func replaceTypingPersonas(with newValue: Set<String>) {
        withMutation(keyPath: \.typingPersonas) {
            withStateLock {
                _typingPersonas = newValue
            }
        }
    }

    private func withStateLock<T>(_ work: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return work()
    }
}

// MARK: - WebSocket Payloads

private struct ServerEventEnvelope: Decodable {
    let type: String
}

private struct AgentMessageEvent: Decodable {
    let from: String
    let content: String
    let persona: RelayPersona?
    let timestamp: String
}

private struct TypingEvent: Decodable {
    let persona: String
    let isTyping: Bool
}

private struct SessionStartedEvent: Decodable {
    let sessionId: String
    let personas: [String]
}

private struct ServerErrorEvent: Decodable {
    let message: String
    let code: String?
}

private struct RelayPersona: Decodable {
    let id: String
}

private struct SendMessagePayload: Encodable {
    let type: String
    let sessionId: String
    let message: String
    let personas: [String]
}
