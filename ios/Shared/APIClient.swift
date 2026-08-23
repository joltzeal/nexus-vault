import Foundation

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init() {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpCookieStorage = HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: AppGroup.identifier
        )
        configuration.httpAdditionalHeaders = [
            "Accept": "application/json",
            "User-Agent": "NexusVault-iOS/1.0",
        ]
        session = URLSession(configuration: configuration)
    }

    func signIn(email: String, password: String) async throws {
        var request = try makeRequest(
            path: "/api/auth/sign-in/email",
            method: "POST",
            body: SignInInput(email: email, password: password)
        )
        request.setValue("ios", forHTTPHeaderField: "X-Nexus-Vault-Client")
        let (data, response) = try await perform(request)
        guard (200..<300).contains(response.statusCode) else {
            throw error(from: data, statusCode: response.statusCode)
        }
    }

    func signOut() async {
        if var request = try? makeRequest(path: "/api/auth/sign-out", method: "POST") {
            request.setValue("ios", forHTTPHeaderField: "X-Nexus-Vault-Client")
            _ = try? await perform(request)
        }
        clearCookies()
    }

    func listVaults() async throws -> [VaultSummary] {
        let request = try makeRequest(path: "/api/v1/vaults")
        let payload: VaultListPayload = try await send(request)
        return payload.items
    }

    func vaultDetail(id: String) async throws -> VaultDetailPayload {
        let request = try makeRequest(path: "/api/v1/vaults/\(id)")
        return try await send(request)
    }

    func listStarredResources() async throws -> [StarredResourceItem] {
        let request = try makeRequest(path: "/api/v1/resource-stars")
        let payload: StarredResourcesPayload = try await send(request)
        return payload.items
    }

    func listReadLaterResources() async throws -> [ReadLaterResourceItem] {
        let request = try makeRequest(path: "/api/v1/resource-read-later")
        let payload: ReadLaterResourcesPayload = try await send(request)
        return payload.items
    }

    func createResource(_ input: ResourceInput) async throws -> CreatedResource {
        let request = try makeRequest(path: "/api/v1/resources", method: "POST", body: input)
        return try await send(request)
    }

    func updateResourceAnnotation(
        resourceID: String,
        patch: ResourceAnnotationPatch
    ) async throws -> ResourceAnnotation? {
        let request = try makeRequest(
            path: "/api/v1/resources/\(resourceID)/annotation",
            method: "PATCH",
            body: patch
        )
        let result: ResourceAnnotationResult = try await send(request)
        return result.annotation
    }

    private func send<Value: Decodable>(_ request: URLRequest) async throws -> Value {
        let (data, response) = try await perform(request)
        guard (200..<300).contains(response.statusCode) else {
            throw error(from: data, statusCode: response.statusCode)
        }

        do {
            let envelope = try decoder.decode(APIEnvelope<Value>.self, from: data)
            guard envelope.success, let value = envelope.data else {
                throw NexusAPIError.server(message: envelope.error?.message ?? "请求失败。")
            }
            return value
        } catch let error as NexusAPIError {
            throw error
        } catch {
            throw NexusAPIError.invalidResponse
        }
    }

    private func makeRequest(path: String, method: String = "GET") throws -> URLRequest {
        try makeRequest(path: path, method: method, bodyData: nil)
    }

    private func makeRequest<Body: Encodable>(
        path: String,
        method: String,
        body: Body
    ) throws -> URLRequest {
        try makeRequest(path: path, method: method, bodyData: encoder.encode(body))
    }

    private func makeRequest(path: String, method: String, bodyData: Data?) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: AppGroup.baseURL)?.absoluteURL else {
            throw NexusAPIError.invalidServerURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = bodyData
        if bodyData != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func perform(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw NexusAPIError.invalidResponse
            }
#if DEBUG
            let method = request.httpMethod ?? "GET"
            let path = request.url?.path ?? ""
            print("[NexusVault] \(method) \(path) -> \(httpResponse.statusCode)")
#endif
            return (data, httpResponse)
        } catch let error as NexusAPIError {
            throw error
        } catch let error as URLError {
            #if DEBUG
            print("[NexusVault] request failed: \(error.code.rawValue) \(error.localizedDescription)")
            #endif
            if error.code == .timedOut {
                throw NexusAPIError.transport(message: "连接生产环境超时，请检查网络后重试。")
            }
            throw NexusAPIError.transport(message: error.localizedDescription)
        } catch {
#if DEBUG
            print("[NexusVault] request failed: \(error.localizedDescription)")
#endif
            throw NexusAPIError.transport(message: error.localizedDescription)
        }
    }

    private func error(from data: Data, statusCode: Int) -> NexusAPIError {
        if statusCode == 401 {
            return .unauthorized
        }
        if let envelope = try? decoder.decode(APIEnvelope<EmptyPayload>.self, from: data),
           let message = envelope.error?.message {
            return .server(message: message)
        }
        if let authError = try? decoder.decode(AuthErrorPayload.self, from: data) {
            return .server(message: authError.message)
        }
        return .server(message: "服务器请求失败（\(statusCode)）。")
    }

    private func clearCookies() {
        let storage = HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: AppGroup.identifier
        )
        storage.cookies?.forEach(storage.deleteCookie)
    }
}

private struct EmptyPayload: Decodable {}

private struct AuthErrorPayload: Decodable {
    let message: String
}
