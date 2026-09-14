import Foundation

public struct SessionUser: Codable, Equatable, Sendable {
    public let id: String
    public let email: String
    public let name: String

    public init(id: String, email: String, name: String) {
        self.id = id; self.email = email; self.name = name
    }
}

public struct Session: Codable, Equatable, Sendable {
    public let token: String
    public let user: SessionUser
    public let expiresAt: Date?

    public init(token: String, user: SessionUser, expiresAt: Date? = nil) {
        self.token = token; self.user = user; self.expiresAt = expiresAt
    }
}

public enum SessionState: Equatable, Sendable {
    case signedOut
    case restoring
    case authenticated(Session)
    case expired
    case failed(String)
}

public enum MetadataStatus: String, Codable, Sendable {
    case pending, processing, completed, failed
}

public struct ResourceMetadata: Codable, Equatable, Sendable {
    public let resourceID: String
    public var status: MetadataStatus
    public var data: [String: String]
    public var errorMessage: String?
    public var updatedAt: Date

    private enum CodingKeys: String, CodingKey {
        case resourceID = "resource_id"
        case status
        case data
        case errorMessage = "error_message"
        case updatedAt = "updated_at"
    }

    public init(resourceID: String, status: MetadataStatus, data: [String: String] = [:], errorMessage: String? = nil, updatedAt: Date = .now) {
        self.resourceID = resourceID; self.status = status; self.data = data
        self.errorMessage = errorMessage; self.updatedAt = updatedAt
    }
}

public enum APIError: Error, Equatable, Sendable {
    case unauthorized
    case invalidResponse(Int)
    case transport(String)
    case decoding(String)
}
