import Foundation

public protocol APIClientProtocol: Sendable {
    func request<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T
}

public final class APIClient: APIClientProtocol, @unchecked Sendable {
    private let session: URLSession
    private let unauthorizedHandler: @Sendable () -> Void
    private let tokenProvider: @Sendable () -> String?

    public init(
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () -> String? = { nil },
        unauthorizedHandler: @escaping @Sendable () -> Void = {},
    ) {
        self.session = session
        self.tokenProvider = tokenProvider
        self.unauthorizedHandler = unauthorizedHandler
    }

    public func request<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        do {
            var authenticatedRequest = request
            if let token = tokenProvider(), !token.isEmpty {
                authenticatedRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            let (data, response) = try await session.data(for: authenticatedRequest)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse(0) }
            guard http.statusCode != 401 else {
                unauthorizedHandler()
                throw APIError.unauthorized
            }
            guard (200..<300).contains(http.statusCode) else { throw APIError.invalidResponse(http.statusCode) }
            do { return try JSONDecoder.nexus.decode(type, from: data) }
            catch { throw APIError.decoding(error.localizedDescription) }
        } catch let error as APIError { throw error }
        catch { throw APIError.transport(error.localizedDescription) }
    }
}

public extension JSONDecoder {
    static var nexus: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }
}

public extension JSONEncoder {
    static var nexus: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }
}
