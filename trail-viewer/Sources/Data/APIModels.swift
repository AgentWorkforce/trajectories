import Foundation

// MARK: - TrajectoryStats

struct TrajectoryStats: Codable, Hashable {
    let total: Int
    let active: Int
    let completed: Int
    let abandoned: Int

    static let empty = TrajectoryStats(total: 0, active: 0, completed: 0, abandoned: 0)
}

// MARK: - APIError

enum APIError: Error, LocalizedError, Equatable {
    case notFound(String)
    case serverError(Int, String?)
    case networkError(Error)
    case decodingError(Error)
    case invalidURL(String)
    case unauthorized
    case unknown(String?)

    var errorDescription: String? {
        switch self {
        case .notFound(let resource):
            return "Resource not found: \(resource)"
        case .serverError(let statusCode, let message):
            if let message = message {
                return "Server error \(statusCode): \(message)"
            }
            return "Server error \(statusCode)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .unauthorized:
            return "Unauthorized access"
        case .unknown(let message):
            return message ?? "An unknown error occurred"
        }
    }

    static func == (lhs: APIError, rhs: APIError) -> Bool {
        switch (lhs, rhs) {
        case (.notFound(let a), .notFound(let b)):
            return a == b
        case (.serverError(let codeA, let msgA), .serverError(let codeB, let msgB)):
            return codeA == codeB && msgA == msgB
        case (.networkError, .networkError):
            return true
        case (.decodingError, .decodingError):
            return true
        case (.invalidURL(let a), .invalidURL(let b)):
            return a == b
        case (.unauthorized, .unauthorized):
            return true
        case (.unknown(let a), .unknown(let b)):
            return a == b
        default:
            return false
        }
    }
}

// MARK: - StartChatResponse

struct StartChatResponse: Codable {
    let sessionId: String
}

// MARK: - APIResponse

struct APIResponse<T: Codable>: Codable {
    let data: T?
    let error: String?
    let success: Bool
}

// MARK: - PaginatedResponse

struct PaginatedResponse<T: Codable>: Codable {
    let data: [T]
    let total: Int
    let page: Int
    let pageSize: Int

    enum CodingKeys: String, CodingKey {
        case data
        case total
        case page
        case pageSize = "page_size"
    }
}
