import Foundation
import SwiftUI

@Observable
class ChatStore {
    // MARK: - Public Properties

    private(set) var chatMessages: [ChatMessage] = []
    private(set) var chatSessionId: String? = nil
    private(set) var personas: [ChatPersona] = []
    var activePersonas: Set<String> = []
    private(set) var typingPersonas: Set<String> = []
    private(set) var sessionState: ChatSessionState = .idle
    private(set) var error: APIError? = nil

    // MARK: - Private Properties

    private let apiClient: APIClient
    private let relayConnection: RelayConnection
    private var observationTask: Task<Void, Never>?

    // MARK: - Computed Properties

    var isActive: Bool {
        sessionState == .active
    }

    var hasSession: Bool {
        chatSessionId != nil
    }

    var activePersonasList: [ChatPersona] {
        personas.filter { activePersonas.contains($0.id) }
    }

    // MARK: - Initializer

    init(apiClient: APIClient = APIClient(), relayConnection: RelayConnection = RelayConnection()) {
        self.apiClient = apiClient
        self.relayConnection = relayConnection
        startObservingRelay()
    }

    // MARK: - Public Methods

    func loadPersonas() async {
        do {
            personas = try await apiClient.getPersonas()
            activePersonas = Set(personas.map(\.id))
        } catch let apiError as APIError {
            error = apiError
        } catch {
            self.error = .networkError(error)
        }
    }

    func startChat(trajectoryId: String) async {
        guard sessionState == .idle || sessionState == .disconnected else { return }

        sessionState = .connecting

        do {
            let response = try await apiClient.startChatSession(
                trajectoryId: trajectoryId,
                personas: Array(activePersonas)
            )
            chatSessionId = response.sessionId
            relayConnection.connect()
            sessionState = .active
            startObservingRelay()
        } catch let apiError as APIError {
            sessionState = .error
            error = apiError
        } catch {
            sessionState = .error
            self.error = .networkError(error)
        }
    }

    func sendMessage(text: String) async {
        guard isActive,
              let sessionId = chatSessionId else { return }

        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return }

        let userMessage = ChatMessage(from: "user", content: trimmedText)
        chatMessages.append(userMessage)
        relayConnection.send(
            sessionId: sessionId,
            text: trimmedText,
            personas: Array(activePersonas)
        )
    }

    func stopChat() async {
        guard let sessionId = chatSessionId else { return }

        do {
            try await apiClient.stopChatSession(sessionId: sessionId)
        } catch {
            // Ignore errors during stop
        }

        relayConnection.disconnect()
        chatSessionId = nil
        sessionState = .idle
        relayConnection.clearMessages()
    }

    func togglePersona(_ personaId: String) {
        if activePersonas.contains(personaId) {
            activePersonas.remove(personaId)
        } else {
            activePersonas.insert(personaId)
        }
    }

    func clearChat() {
        chatMessages = []
    }

    // MARK: - Private Methods

    private func startObservingRelay() {
        observationTask?.cancel()
        observationTask = Task { [weak self] in
            guard let self else { return }

            var lastMessageCount = 0

            while !Task.isCancelled {
                let currentMessages = relayConnection.messages
                if currentMessages.count < lastMessageCount {
                    lastMessageCount = currentMessages.count
                }

                if currentMessages.count > lastMessageCount {
                    let newMessages = Array(currentMessages.dropFirst(lastMessageCount))
                    for message in newMessages {
                        chatMessages.append(message)
                    }
                    lastMessageCount = currentMessages.count
                }

                typingPersonas = relayConnection.typingPersonas

                try? await Task.sleep(for: .milliseconds(250))
            }
        }
    }
}
