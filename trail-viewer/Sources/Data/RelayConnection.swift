//
//  RelayConnection.swift
//  Trail Viewer
//
//  Thin @Observable wrapper around AgentRelaySDK's RelayObserver.
//  Keeps the chat-facing surface area stable for ChatStore while delegating
//  WebSocket lifecycle, event decoding, and reconnect behavior to the SDK.
//

import Foundation
import Observation
import AgentRelaySDK

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
final class RelayConnection: NSObject {

    // MARK: - Public Properties

    private(set) var state: ConnectionState = .disconnected
    private(set) var messages: [ChatMessage] = []
    private(set) var typingPersonas: Set<String> = []

    // MARK: - Private Properties

    private let wsBaseURL: URL
    private let maxReconnectAttempts: Int
    private let baseReconnectDelay: TimeInterval
    // `connect()` has no session parameter, so we subscribe to a shared fallback
    // channel until `send(sessionId:...)` establishes a session-specific one.
    private let fallbackChannel: String

    private var currentChannel: String
    private var isIntentionalDisconnect: Bool = false

    @ObservationIgnored private var observer: RelayObserver?
    @ObservationIgnored private var connectionMonitorTask: Task<Void, Never>?
    @ObservationIgnored private let decoder = JSONDecoder()
    @ObservationIgnored private let iso8601Formatter = ISO8601DateFormatter()

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
        self.fallbackChannel = fallbackChannel
        self.currentChannel = fallbackChannel
        super.init()
    }

    // MARK: - Connect

    func connect() {
        isIntentionalDisconnect = false
        state = .connecting

        let observer = RelayObserver(
            maxReconnectAttempts: maxReconnectAttempts,
            baseReconnectDelay: baseReconnectDelay
        )
        observer.delegate = self

        self.observer?.delegate = nil
        self.observer?.disconnect()
        self.observer = observer

        startMonitoringConnectionState(for: observer)
        observer.connect(url: webSocketURL(path: "/ws"), channel: currentChannel)
    }

    // MARK: - Disconnect

    func disconnect() {
        isIntentionalDisconnect = true
        connectionMonitorTask?.cancel()
        connectionMonitorTask = nil

        observer?.delegate = nil
        observer?.disconnect()
        observer = nil

        state = .disconnected
        typingPersonas = []
        currentChannel = fallbackChannel
    }

    // MARK: - Send

    func send(sessionId: String, text: String, personas: [String]) {
        // The current chat contract passes `sessionId`; in the relay-backed path
        // we treat that identifier as the channel name for outbound messages.
        let channel = sessionId

        if observer == nil {
            currentChannel = channel
            connect()
        } else {
            ensureSubscribed(to: channel)
        }

        do {
            try observer?.sendChannel(
                channel: channel,
                text: text,
                personas: personas.isEmpty ? nil : personas
            )
        } catch {
            print("[RelayConnection] Send error: \(error.localizedDescription)")
        }
    }

    // MARK: - Clear

    func clearMessages() {
        messages = []
        typingPersonas = []
    }

    // MARK: - Helpers

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

    private func ensureSubscribed(to channel: String) {
        guard currentChannel != channel else { return }
        currentChannel = channel
        state = .connecting
        observer?.connect(url: webSocketURL(path: "/ws"), channel: channel)
    }

    private func startMonitoringConnectionState(for observer: RelayObserver) {
        connectionMonitorTask?.cancel()
        connectionMonitorTask = Task { [weak self, weak observer] in
            var lastState: RelayObserver.ConnectionState?

            while !Task.isCancelled, let self, let observer {
                let currentState = observer.connectionState
                if currentState != lastState {
                    await MainActor.run {
                        self.applyObserverConnectionState(currentState)
                    }
                    lastState = currentState
                }

                try? await Task.sleep(for: .milliseconds(250))
            }
        }
    }

    private func applyObserverConnectionState(_ observerState: RelayObserver.ConnectionState) {
        switch observerState {
        case .disconnected:
            if isIntentionalDisconnect {
                state = .disconnected
            } else if state != .failed {
                state = .disconnected
            }
        case .connecting:
            state = .connecting
        case .connected:
            state = .connected
        case .reconnecting:
            state = .reconnecting
        }
    }

    private func handleRelayEvent(_ event: RelayObserverEvent) {
        switch event.type {
        case .channelMessage:
            if handleStructuredPayload(
                text: event.text,
                fallbackSender: event.from,
                fallbackTimestamp: event.timestamp
            ) {
                return
            }

            appendMessage(
                from: event.from,
                content: event.text,
                persona: inferredPersonaID(from: event.from),
                timestamp: event.timestamp
            )

        case .delivery:
            guard event.state != "failed" else { return }

            if handleStructuredPayload(
                text: event.text,
                fallbackSender: event.from,
                fallbackTimestamp: nil
            ) {
                return
            }

            appendMessage(
                from: event.from,
                content: event.text,
                persona: inferredPersonaID(from: event.from),
                timestamp: nil
            )

        case .error:
            if let message = event.message {
                print("[RelayConnection] Relay error: \(message)")
            }

        case .ack, .agentIdle, .agentReleased, .agentSpawned, .agentStatus,
             .commentDetected, .commentPollTick, .connected, .pong,
             .relayConfig, .relayWorkspace, .runCompleted, .stepCompleted,
             .stepStarted, .subscribed, .workerStream:
            break
        }
    }

    @discardableResult
    private func handleStructuredPayload(
        text: String?,
        fallbackSender: String?,
        fallbackTimestamp: String?
    ) -> Bool {
        guard let text, let data = text.data(using: .utf8) else {
            return false
        }

        guard let payload = try? decoder.decode(StructuredRelayPayload.self, from: data),
              let type = payload.type else {
            return false
        }

        switch type {
        case "agent_message", "channel_message":
            appendMessage(
                from: payload.from ?? fallbackSender,
                content: payload.content ?? text,
                persona: payload.personaID ?? inferredPersonaID(from: payload.from ?? fallbackSender),
                timestamp: payload.timestamp ?? fallbackTimestamp
            )
            return true

        case "typing":
            guard let personaID = payload.personaID else { return true }
            let isTyping = payload.isTyping ?? (payload.content != "stop")
            if isTyping {
                typingPersonas.insert(personaID)
            } else {
                typingPersonas.remove(personaID)
            }
            return true

        case "error":
            let message = payload.content ?? payload.message ?? text
            print("[RelayConnection] Relay error: \(message)")
            return true

        default:
            return false
        }
    }

    private func appendMessage(
        from sender: String?,
        content: String?,
        persona: String?,
        timestamp: String?
    ) {
        guard let content, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        messages.append(
            ChatMessage(
                from: sender ?? "agent",
                content: content,
                persona: persona,
                timestamp: parsedDate(from: timestamp) ?? Date()
            )
        )
    }

    private func parsedDate(from timestamp: String?) -> Date? {
        guard let timestamp else { return nil }
        return iso8601Formatter.date(from: timestamp)
    }

    private func inferredPersonaID(from sender: String?) -> String? {
        guard let sender, sender.hasPrefix("persona-") else {
            return nil
        }

        let remainder = sender.dropFirst("persona-".count)
        guard let separatorIndex = remainder.lastIndex(of: "-") else {
            return String(remainder)
        }

        return String(remainder[..<separatorIndex])
    }
}

// MARK: - RelayObserverDelegate

extension RelayConnection: RelayObserverDelegate {

    func relayObserver(_ observer: RelayObserver, didReceiveEvent event: RelayObserverEvent) {
        applyObserverConnectionState(observer.connectionState)
        handleRelayEvent(event)
    }

    func relayObserverDidConnect(_ observer: RelayObserver) {
        state = .connected
    }

    func relayObserverDidDisconnect(_ observer: RelayObserver, error: Error?) {
        if isIntentionalDisconnect {
            state = .disconnected
        } else if error != nil {
            state = .failed
        } else {
            state = .disconnected
        }
    }
}

// MARK: - Structured Relay Payloads

private struct StructuredRelayPayload: Decodable {
    let type: String?
    let from: String?
    let content: String?
    let personaID: String?
    let timestamp: String?
    let isTyping: Bool?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case type
        case from
        case content
        case persona
        case timestamp
        case isTyping
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        from = try container.decodeIfPresent(String.self, forKey: .from)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        timestamp = try container.decodeIfPresent(String.self, forKey: .timestamp)
        isTyping = try container.decodeIfPresent(Bool.self, forKey: .isTyping)
        message = try container.decodeIfPresent(String.self, forKey: .message)

        if let persona = try container.decodeIfPresent(String.self, forKey: .persona) {
            personaID = persona
        } else if let persona = try container.decodeIfPresent(StructuredRelayPersona.self, forKey: .persona) {
            personaID = persona.id
        } else {
            personaID = nil
        }
    }
}

private struct StructuredRelayPersona: Decodable {
    let id: String
}
