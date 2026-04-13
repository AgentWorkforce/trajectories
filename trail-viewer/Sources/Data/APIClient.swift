import Foundation

/// Actor-based API client for communicating with the Trail Viewer backend server.
actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL = AppConfiguration.serverBaseURL) {
        self.baseURL = baseURL
        self.session = .shared

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        // The API returns ISO 8601 dates with fractional seconds (e.g. "2026-02-19T08:46:34.162Z")
        // which the default .iso8601 strategy doesn't handle.
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            let primary = ISO8601DateFormatter()
            primary.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = primary.date(from: dateString) { return date }
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            if let date = fallback.date(from: dateString) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(dateString)")
        }

        self.decoder = decoder
    }

    // MARK: - Private Helpers

    private func request<T: Decodable>(
        _ endpoint: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL(endpoint)
        }

        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL(endpoint)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            urlRequest.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown(nil)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            switch httpResponse.statusCode {
            case 401:
                throw APIError.unauthorized
            case 404:
                throw APIError.notFound(endpoint)
            default:
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, message)
            }
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func requestRawText(
        _ endpoint: String,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> String {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL(endpoint)
        }

        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL(endpoint)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown(nil)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            switch httpResponse.statusCode {
            case 401:
                throw APIError.unauthorized
            case 404:
                throw APIError.notFound(endpoint)
            default:
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, message)
            }
        }

        guard let text = String(data: data, encoding: .utf8) else {
            throw APIError.decodingError(DecodingError.dataCorrupted(
                .init(codingPath: [], debugDescription: "Response is not valid UTF-8 text")
            ))
        }

        return text
    }

    // MARK: - Trajectories

    func listTrajectories(
        status: TrajectoryStatus? = nil,
        search: String? = nil,
        tags: [String]? = nil
    ) async throws -> [TrajectorySummary] {
        var queryItems: [URLQueryItem] = []

        if let status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        if let search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        if let tags, !tags.isEmpty {
            queryItems.append(URLQueryItem(name: "tags", value: tags.joined(separator: ",")))
        }

        return try await request(
            "/api/trajectories",
            queryItems: queryItems.isEmpty ? nil : queryItems
        )
    }

    func getTrajectory(id: String) async throws -> Trajectory {
        try await request("/api/trajectories/\(id)")
    }

    func getTrajectoryMarkdown(id: String) async throws -> String {
        try await requestRawText("/api/trajectories/\(id)/markdown")
    }

    func getTrajectoryTimeline(id: String) async throws -> String {
        try await requestRawText("/api/trajectories/\(id)/timeline")
    }

    // MARK: - Config

    func switchDataDir(path: String) async throws {
        struct SwitchRequest: Encodable { let path: String }
        struct SwitchResponse: Decodable { let ok: Bool?; let trajectoryCount: Int? }
        let _: SwitchResponse = try await request(
            "/api/config/data-dir",
            method: "POST",
            body: SwitchRequest(path: path)
        )
    }

    // MARK: - Stats

    func getStats() async throws -> TrajectoryStats {
        try await request("/api/stats")
    }

    // MARK: - Chat

    func getPersonas() async throws -> [ChatPersona] {
        try await request("/api/chat/personas")
    }

    func startChatSession(
        trajectoryId: String,
        personas: [String],
        preferredCLI: String? = nil
    ) async throws -> StartChatResponse {
        var body: [String: Any] = [
            "trajectoryId": trajectoryId,
            "personas": personas
        ]
        if let preferredCLI {
            body["preferredCli"] = preferredCLI
        }

        return try await request(
            "/api/chat/start",
            method: "POST",
            body: StartChatRequest(
                trajectoryId: trajectoryId,
                personas: personas,
                preferredCli: preferredCLI
            )
        )
    }

    func sendChatMessage(
        sessionId: String,
        message: String,
        personas: [String]
    ) async throws {
        let _: EmptyResponse = try await request(
            "/api/chat/message",
            method: "POST",
            body: ChatMessageRequest(
                sessionId: sessionId,
                message: message,
                personas: personas
            )
        )
    }

    func stopChatSession(sessionId: String) async throws {
        let _: EmptyResponse = try await request(
            "/api/chat/stop",
            method: "POST",
            body: StopChatRequest(sessionId: sessionId)
        )
    }
}

// MARK: - Request Body Types

private struct StartChatRequest: Encodable {
    let trajectoryId: String
    let personas: [String]
    let preferredCli: String?
}

private struct ChatMessageRequest: Encodable {
    let sessionId: String
    let message: String
    let personas: [String]
}

private struct StopChatRequest: Encodable {
    let sessionId: String
}

private struct EmptyResponse: Decodable {}

// MARK: - Type-Erased Encodable Wrapper

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        self._encode = wrapped.encode(to:)
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
