# RelayConnection.swift — Complete File Contents

Write this file to: `trail-viewer/Sources/Data/RelayConnection.swift`

```swift
//
//  RelayConnection.swift
//  Trail Viewer
//
//  Manages the WebSocket connection to the Trail Viewer relay server.
//  Handles connecting, disconnecting, sending messages, receiving messages,
//  and automatic reconnection with exponential backoff.
//

import Foundation
import SwiftUI

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
class RelayConnection {

    // MARK: - Public Properties

    private(set) var state: ConnectionState = .disconnected
    private(set) var messages: [ChatMessage] = []
    private(set) var typingPersonas: Set<String> = []

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession = .shared
    private var wsBaseURL: URL = AppConfiguration.wsBaseURL
    private var retryCount: Int = 0
    private let maxRetries: Int = 5
    private var isIntentionalDisconnect: Bool = false

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    // MARK: - Connect

    func connect() {
        state = .connecting
        isIntentionalDisconnect = false

        let url = wsBaseURL.appending(path: "/ws")
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        state = .connected
        retryCount = 0

        receiveMessage()
    }

    // MARK: - Disconnect

    func disconnect() {
        isIntentionalDisconnect = true
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        state = .disconnected
        typingPersonas = []
    }

    // MARK: - Send

    func send(sessionId: String, text: String, personas: [String]) {
        let payload: [String: Any] = [
            "type": "user_message",
            "session_id": sessionId,
            "content": text,
            "personas": personas
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }

        webSocketTask?.send(.string(jsonString)) { error in
            if let error {
                print("[RelayConnection] Send error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Receive

    private func receiveMessage() {
        Task { [weak self] in
            guard let self else { return }

            while self.webSocketTask != nil {
                do {
                    guard let message = try await self.webSocketTask?.receive() else {
                        break
                    }

                    switch message {
                    case .string(let text):
                        guard let data = text.data(using: .utf8) else { continue }

                        do {
                            let wsMessage = try self.decoder.decode(ChatWebSocketMessage.self, from: data)
                            await MainActor.run {
                                self.handleMessage(wsMessage)
                            }
                        } catch {
                            print("[RelayConnection] Decode error: \(error.localizedDescription)")
                        }

                    case .data(let data):
                        do {
                            let wsMessage = try self.decoder.decode(ChatWebSocketMessage.self, from: data)
                            await MainActor.run {
                                self.handleMessage(wsMessage)
                            }
                        } catch {
                            print("[RelayConnection] Decode error: \(error.localizedDescription)")
                        }

                    @unknown default:
                        break
                    }
                } catch {
                    if !self.isIntentionalDisconnect {
                        print("[RelayConnection] Receive error: \(error.localizedDescription)")
                        await MainActor.run {
                            self.webSocketTask = nil
                            self.reconnect()
                        }
                    }
                    break
                }
            }
        }
    }

    // MARK: - Handle Message

    private func handleMessage(_ wsMessage: ChatWebSocketMessage) {
        switch wsMessage.type {
        case "agent_message":
            let chatMessage = ChatMessage(
                from: wsMessage.from ?? "agent",
                content: wsMessage.content ?? "",
                persona: wsMessage.persona
            )
            messages.append(chatMessage)

        case "typing":
            if let persona = wsMessage.persona {
                if wsMessage.content == "stop" {
                    typingPersonas.remove(persona)
                } else {
                    typingPersonas.insert(persona)
                }
            }

        case "error":
            print("[RelayConnection] Server error: \(wsMessage.content ?? "unknown")")

        default:
            break
        }
    }

    // MARK: - Reconnect

    private func reconnect() {
        guard retryCount < maxRetries else {
            state = .failed
            return
        }

        state = .reconnecting
        let delay = min(pow(2.0, Double(retryCount)), 30.0)

        Task { [weak self] in
            guard let self else { return }

            do {
                try await Task.sleep(for: .seconds(delay))
                self.retryCount += 1
                await MainActor.run {
                    self.connect()
                }
            } catch {
                await MainActor.run {
                    self.state = .failed
                }
            }
        }
    }

    // MARK: - Clear

    func clearMessages() {
        messages = []
        typingPersonas = []
    }
}
```
