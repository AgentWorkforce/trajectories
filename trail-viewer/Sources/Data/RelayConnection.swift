//
//  RelayConnection.swift
//  Trail Viewer
//
//  Native @Observable wrapper around AgentRelaySDK's RelayCast client.
//  Connects directly to a broker channel, appends chat messages from channel
//  events, and posts outbound user messages back to that channel.
//

import AgentRelaySDK
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

    private let relayAPIKey: String?
    private let relayBaseURL: URL?

    @ObservationIgnored private let stateLock = NSLock()
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

    @ObservationIgnored private var relayCast: RelayCast?
    @ObservationIgnored private var relayChannel: Channel?
    @ObservationIgnored private var currentChannelName: String?
    @ObservationIgnored private var connectionToken = UUID()
    @ObservationIgnored private var connectTask: Task<Void, Never>?
    @ObservationIgnored private var eventTask: Task<Void, Never>?
    @ObservationIgnored private var connectionStateTask: Task<Void, Never>?
    @ObservationIgnored private var pendingOutboundMessages: [String] = []
    @ObservationIgnored private var isFlushingOutboundMessages = false
    @ObservationIgnored private var isIntentionalDisconnect = false

    // MARK: - Init

    init(
        relayAPIKey: String? = ProcessInfo.processInfo.environment["RELAY_API_KEY"],
        relayBaseURL: URL? = ProcessInfo.processInfo.environment["RELAY_BASE_URL"].flatMap(URL.init(string:))
    ) {
        self.relayAPIKey = relayAPIKey?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.relayBaseURL = relayBaseURL
    }

    deinit {
        connectTask?.cancel()
        eventTask?.cancel()
        connectionStateTask?.cancel()

        if let relay = relaySnapshot() {
            Task {
                await relay.disconnect()
            }
        }
    }

    // MARK: - Connect

    func connect(channel channelName: String) {
        let trimmedChannel = channelName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedChannel.isEmpty else {
            setStateValue(.failed)
            return
        }

        guard let relayAPIKey, !relayAPIKey.isEmpty else {
            print("[RelayConnection] Missing RELAY_API_KEY; cannot connect to relay broker.")
            setStateValue(.failed)
            return
        }

        if shouldReuseConnection(for: trimmedChannel) {
            return
        }

        let token = UUID()
        let previousRelay = replaceConnectionStateForNewChannel(trimmedChannel, token: token)
        replaceTypingPersonas(with: [])
        setStateValue(.connecting)

        if let previousRelay {
            Task {
                await previousRelay.disconnect()
            }
        }

        let relay = RelayCast(apiKey: relayAPIKey, baseURL: relayBaseURL)
        let channel = relay.channel(trimmedChannel)
        storeRelay(relay, channel: channel, token: token)

        let connectionStateTask = Task { [weak self] in
            for await change in relay.connectionState {
                self?.handleConnectionStateChange(change, token: token)
            }
        }

        let eventTask = Task { [weak self] in
            for await event in channel.events {
                self?.handleChannelEvent(event, token: token)
            }
        }

        storeTasks(eventTask: eventTask, connectionStateTask: connectionStateTask, token: token)

        let connectTask = Task { [weak self] in
            do {
                try await channel.subscribe()
                self?.handleConnectionEstablished(token: token)
            } catch {
                self?.handleConnectionFailure(error, token: token)
                await relay.disconnect()
            }
        }

        storeConnectTask(connectTask, token: token)
    }

    // MARK: - Disconnect

    func disconnect() {
        let relay = clearConnectionState(intentionalDisconnect: true)
        replaceTypingPersonas(with: [])
        setStateValue(.disconnected)

        if let relay {
            Task {
                await relay.disconnect()
            }
        }
    }

    // MARK: - Send

    func send(sessionId: String, text: String, personas: [String]) {
        _ = sessionId
        _ = personas

        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }

        let channelName = enqueueMessage(trimmedText)
        guard let channelName else {
            print("[RelayConnection] Ignoring outbound chat message because no relay channel is active.")
            return
        }

        let state = stateSnapshot()
        if relayChannelSnapshot() == nil || state == .disconnected || state == .failed {
            connect(channel: channelName)
            return
        }

        flushPendingMessagesIfPossible()
    }

    // MARK: - Clear

    func clearMessages() {
        replaceMessages(with: [])
        replaceTypingPersonas(with: [])
    }

    // MARK: - Connection Helpers

    private func shouldReuseConnection(for channelName: String) -> Bool {
        withStateLock {
            currentChannelName == channelName &&
            relayCast != nil &&
            (_state == .connecting || _state == .connected || _state == .reconnecting)
        }
    }

    private func replaceConnectionStateForNewChannel(_ channelName: String, token: UUID) -> RelayCast? {
        withStateLock {
            let previousRelay = relayCast
            connectTask?.cancel()
            eventTask?.cancel()
            connectionStateTask?.cancel()
            connectTask = nil
            eventTask = nil
            connectionStateTask = nil
            relayCast = nil
            relayChannel = nil
            currentChannelName = channelName
            connectionToken = token
            isFlushingOutboundMessages = false
            isIntentionalDisconnect = false
            return previousRelay
        }
    }

    private func clearConnectionState(intentionalDisconnect: Bool) -> RelayCast? {
        withStateLock {
            let relay = relayCast
            connectTask?.cancel()
            eventTask?.cancel()
            connectionStateTask?.cancel()
            connectTask = nil
            eventTask = nil
            connectionStateTask = nil
            relayCast = nil
            relayChannel = nil
            currentChannelName = nil
            connectionToken = UUID()
            pendingOutboundMessages = []
            isFlushingOutboundMessages = false
            isIntentionalDisconnect = intentionalDisconnect
            return relay
        }
    }

    private func storeRelay(_ relay: RelayCast, channel: Channel, token: UUID) {
        withStateLock {
            guard connectionToken == token else { return }
            relayCast = relay
            relayChannel = channel
        }
    }

    private func storeTasks(eventTask: Task<Void, Never>, connectionStateTask: Task<Void, Never>, token: UUID) {
        let shouldStore = withStateLock {
            guard connectionToken == token else { return false }
            self.eventTask = eventTask
            self.connectionStateTask = connectionStateTask
            return true
        }

        guard shouldStore else {
            eventTask.cancel()
            connectionStateTask.cancel()
            return
        }
    }

    private func storeConnectTask(_ connectTask: Task<Void, Never>, token: UUID) {
        let shouldStore = withStateLock {
            guard connectionToken == token else { return false }
            self.connectTask = connectTask
            return true
        }

        guard shouldStore else {
            connectTask.cancel()
            return
        }
    }

    private func handleConnectionEstablished(token: UUID) {
        guard isCurrentConnection(token) else { return }

        withStateLock {
            connectTask = nil
        }

        setStateValue(.connected)
        flushPendingMessagesIfPossible()
    }

    private func handleConnectionFailure(_ error: Error, token: UUID) {
        guard isCurrentConnection(token) else { return }

        print("[RelayConnection] Failed to subscribe to relay channel: \(error.localizedDescription)")

        withStateLock {
            connectTask = nil
            eventTask?.cancel()
            connectionStateTask?.cancel()
            eventTask = nil
            connectionStateTask = nil
            relayCast = nil
            relayChannel = nil
            isFlushingOutboundMessages = false
        }

        if !isIntentionalDisconnectSnapshot() {
            setStateValue(.failed)
        }
    }

    private func handleConnectionStateChange(_ change: ConnectionStateChange, token: UUID) {
        guard isCurrentConnection(token) else { return }

        switch change {
        case .connected:
            setStateValue(.connected)
            flushPendingMessagesIfPossible()
        case .disconnected:
            if isIntentionalDisconnectSnapshot() {
                setStateValue(.disconnected)
            } else {
                setStateValue(.reconnecting)
            }
        case .reconnecting(attempt: _):
            setStateValue(.reconnecting)
        }
    }

    private func relaySnapshot() -> RelayCast? {
        withStateLock { relayCast }
    }

    private func relayChannelSnapshot() -> Channel? {
        withStateLock { relayChannel }
    }

    private func isCurrentConnection(_ token: UUID) -> Bool {
        withStateLock { connectionToken == token }
    }

    private func isIntentionalDisconnectSnapshot() -> Bool {
        withStateLock { isIntentionalDisconnect }
    }

    // MARK: - Outbound Queue

    private func enqueueMessage(_ message: String) -> String? {
        withStateLock {
            pendingOutboundMessages.append(message)
            return currentChannelName
        }
    }

    private func flushPendingMessagesIfPossible() {
        let outbound: (message: String, channel: Channel)? = withStateLock {
            guard !isFlushingOutboundMessages,
                  _state == .connected,
                  let relayChannel,
                  !pendingOutboundMessages.isEmpty else {
                return nil
            }

            isFlushingOutboundMessages = true
            return (pendingOutboundMessages.removeFirst(), relayChannel)
        }

        guard let outbound else { return }

        Task { [weak self] in
            do {
                try await outbound.channel.post(outbound.message)
                self?.handleOutboundDeliverySuccess()
            } catch {
                self?.handleOutboundDeliveryFailure(outbound.message, error: error)
            }
        }
    }

    private func handleOutboundDeliverySuccess() {
        withStateLock {
            isFlushingOutboundMessages = false
        }

        flushPendingMessagesIfPossible()
    }

    private func handleOutboundDeliveryFailure(_ message: String, error: Error) {
        print("[RelayConnection] Failed to post channel message: \(error.localizedDescription)")

        let channelName = withStateLock {
            pendingOutboundMessages.insert(message, at: 0)
            isFlushingOutboundMessages = false
            return currentChannelName
        }

        guard let channelName else {
            setStateValue(.failed)
            return
        }

        setStateValue(.reconnecting)
        connect(channel: channelName)
    }

    // MARK: - Event Parsing

    private func handleChannelEvent(_ event: RelayChannelEvent, token: UUID) {
        guard isCurrentConnection(token) else { return }

        switch parseChannelEventBody(event.body) {
        case .typing(let persona, let isTyping):
            updateTypingPersona(persona, isTyping: isTyping)
        case .agentMessage(let from, let content, let persona, let timestamp):
            let sender = from ?? event.from
            appendMessage(
                from: sender,
                content: content,
                persona: persona,
                timestamp: timestamp ?? event.timestamp
            )
            updateTypingPersona(persona ?? sender, isTyping: false)
        case .ignore:
            break
        case .none:
            appendMessage(from: event.from, content: event.body, persona: nil, timestamp: event.timestamp)
            updateTypingPersona(event.from, isTyping: false)
        }
    }

    private func parseChannelEventBody(_ body: String) -> ParsedChannelEventBody? {
        guard let data = body.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        let type = stringValue(payload["type"])
        let content = stringValue(payload["content"])
            ?? stringValue(payload["message"])
            ?? stringValue(payload["text"])
            ?? stringValue(payload["body"])
        let timestamp = stringValue(payload["timestamp"]).flatMap(parsedDate(from:))

        switch type {
        case "typing":
            guard let persona = personaID(from: payload["persona"]) ?? stringValue(payload["from"]) else {
                return .ignore
            }

            let isTyping = boolValue(payload["isTyping"]) ?? boolValue(payload["is_typing"]) ?? true
            return .typing(persona: persona, isTyping: isTyping)

        case "agent_message":
            guard let content else { return .ignore }
            let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedContent.isEmpty else { return .ignore }

            return .agentMessage(
                from: stringValue(payload["from"]),
                content: trimmedContent,
                persona: personaID(from: payload["persona"]),
                timestamp: timestamp
            )

        case .none:
            guard let content else { return .ignore }
            let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedContent.isEmpty else { return .ignore }

            return .agentMessage(
                from: stringValue(payload["from"]),
                content: trimmedContent,
                persona: personaID(from: payload["persona"]),
                timestamp: timestamp
            )

        default:
            return .ignore
        }
    }

    private func stringValue(_ value: Any?) -> String? {
        if let string = value as? String {
            return string
        }

        if let dictionary = value as? [String: Any] {
            return dictionary["id"] as? String
        }

        return nil
    }

    private func boolValue(_ value: Any?) -> Bool? {
        if let bool = value as? Bool {
            return bool
        }

        if let number = value as? NSNumber {
            return number.boolValue
        }

        return nil
    }

    private func personaID(from value: Any?) -> String? {
        if let string = value as? String {
            return string
        }

        if let dictionary = value as? [String: Any] {
            return dictionary["id"] as? String
        }

        return nil
    }

    // MARK: - Message Helpers

    private func appendMessage(
        from sender: String,
        content: String,
        persona: String?,
        timestamp: Date
    ) {
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedContent.isEmpty else { return }

        var updatedMessages = messagesSnapshot()
        updatedMessages.append(
            ChatMessage(
                from: sender,
                content: trimmedContent,
                persona: persona,
                timestamp: timestamp
            )
        )
        replaceMessages(with: updatedMessages)
    }

    private func updateTypingPersona(_ personaID: String, isTyping: Bool) {
        let trimmedPersonaID = personaID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPersonaID.isEmpty else { return }

        var updatedTypingPersonas = typingPersonasSnapshot()
        if isTyping {
            updatedTypingPersonas.insert(trimmedPersonaID)
        } else {
            updatedTypingPersonas.remove(trimmedPersonaID)
        }
        replaceTypingPersonas(with: updatedTypingPersonas)
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

// MARK: - Event Payloads

private enum ParsedChannelEventBody {
    case agentMessage(from: String?, content: String, persona: String?, timestamp: Date?)
    case typing(persona: String, isTyping: Bool)
    case ignore
}
