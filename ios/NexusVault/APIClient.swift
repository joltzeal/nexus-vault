import Foundation

final class APIClient {
    static let shared = APIClient()
    let baseURL = URL(string: "https://nexus-vault.stacklabs.space")!
    private let session: URLSession
    private init() {
        let c = URLSessionConfiguration.default
        c.httpCookieStorage = .shared
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 120
        session = URLSession(configuration: c)
    }
    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        guard let url = URL(string: "/api/v1\(path)", relativeTo: baseURL)
        else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await session.data(for: req) } catch {
            throw APIError.offline
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(-1)
        }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            if let payload = try? JSONSerialization.jsonObject(with: data)
                as? [String: Any], let message = payload["message"] as? String
            {
                throw APIError.server(message)
            }
            throw APIError.http(http.statusCode)
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        do { return try JSONDecoder().decode(T.self, from: data) } catch {
            throw APIError.decoding
        }
    }
    func loadVaults(query: String? = nil) async throws -> [VaultSummary] {
        let suffix =
            query.map {
                "?q=\($0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
            } ?? ""
        let result: APIEnvelope<[VaultSummary]> = try await request(
            "/vaults\(suffix)"
        )
        return result.items
    }
    func loadVaultDetail(_ id: String) async throws -> VaultDetailPayload {
        try await request("/vaults/\(id)")
    }
    func loadStarredResources() async throws -> [VaultResource] {
        let r: APIEnvelope<[StarredDTO]> = try await request("/resource-stars")
        return r.items.map { $0.resource }
    }
    func loadReadLaterResources() async throws -> [VaultResource] {
        let r: APIEnvelope<[ReadLaterDTO]> = try await request(
            "/resource-read-later"
        )
        return r.items.map { $0.resource }
    }
    func createResource(_ request: CreateResourceRequest) async throws -> String
    {
        let r: CreatedResource = try await self.request(
            "/resources",
            method: "POST",
            body: request
        )
        return r.id
    }
    func toggleStar(_ id: String, enabled: Bool) async throws {
        let _: EmptyResponse = try await request(
            "/resources/\(id)/star",
            method: enabled ? "POST" : "DELETE"
        )
    }
    func toggleReadLater(_ id: String, enabled: Bool) async throws {
        let _: EmptyResponse = try await request(
            "/resources/\(id)/read-later",
            method: enabled ? "POST" : "DELETE"
        )
    }
    func updateAnnotation(_ id: String, patch: AnnotationPatch) async throws {
        let _: EmptyResponse = try await request(
            "/resources/\(id)/annotation",
            method: "PATCH",
            body: patch
        )
    }
    func signOut() async throws {
        let _: EmptyResponse = try await authRequest(
            "/sign-out",
            method: "POST"
        )
    }
    func sessionUser() async throws -> SessionUser? {
        let response: SessionResponse = try await authRequest("/get-session")
        return response.user
    }
    func signIn(email: String, password: String) async throws -> SessionUser? {
        struct Body: Encodable {
            let email: String
            let password: String
        }
        let _: EmptyResponse = try await authRequest(
            "/sign-in/email",
            method: "POST",
            body: Body(email: email, password: password)
        )
        return try await sessionUser()
    }
    private func authRequest<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        guard let url = URL(string: "/api/auth\(path)", relativeTo: baseURL)
        else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(-1)
        }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server("认证失败")
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
struct CreatedResource: Decodable { let id: String }
struct EmptyResponse: Decodable { init() {} }
private struct StarredDTO: Decodable {
    let sourceResourceId: String
    let sourceSpaceId: String?
    let type: String
    let title: String
    let description: String?
    let url: String?
    let referer: String?
    let metadataStatus: String?
    let position: Int?
    let resourceUpdatedAt: String?
    let sourceCreatedAt: String?
    let metadataProvider: String?
    let metadataDataJson: MetadataData?
    let metadataErrorMessage: String?
    let metadataUpdatedAt: String?
    let isReadLater: Bool
    var resource: VaultResource {
        VaultResource(
            id: sourceResourceId,
            spaceId: sourceSpaceId,
            type: type,
            title: title,
            description: description,
            url: url,
            referer: referer,
            metadataStatus: metadataStatus,
            position: position,
            createdAt: sourceCreatedAt,
            updatedAt: resourceUpdatedAt,
            isStarred: true,
            isReadLater: isReadLater,
            annotation: nil,
            metadata: metadataProvider.map {
                ResourceMetadata(
                    provider: $0,
                    data: metadataDataJson,
                    errorMessage: metadataErrorMessage,
                    updatedAt: metadataUpdatedAt
                )
            }
        )
    }
}
private struct ReadLaterDTO: Decodable { let resource: VaultResource }
struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void
    init(_ value: Encodable) { encodeClosure = value.encode }
    func encode(to encoder: Encoder) throws { try encodeClosure(encoder) }
}
