import XCTest
import Foundation
@testable import NexusVaultCore

final class CoreTests: XCTestCase {
    func testSessionRestoresAndHandles401() async {
        let user = SessionUser(id: "u1", email: "a@b.test", name: "A")
        let store = await MainActor.run { SessionStore { Session(token: "t", user: user) } }
        await MainActor.run { store.restoreIfNeeded() }
        try? await Task.sleep(nanoseconds: 20_000_000)
        let authenticatedState = await MainActor.run { store.state }
        XCTAssertEqual(authenticatedState, .authenticated(Session(token: "t", user: user)))
        await MainActor.run { store.handleUnauthorized() }
        let expiredState = await MainActor.run { store.state }
        XCTAssertEqual(expiredState, .expired)
    }

    func testAPIClientInjectsTokenAndHandlesUnauthorized() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        StubURLProtocol.handler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token")
            return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }
        let unauthorized = LockedFlag()
        let client = APIClient(session: URLSession(configuration: configuration), tokenProvider: { "token" }, unauthorizedHandler: { unauthorized.setTrue() })
        var request = URLRequest(url: URL(string: "https://example.test/session")!)
        request.httpMethod = "GET"
        do {
            _ = try await client.request(request, as: Session.self)
            XCTFail("Expected unauthorized error")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        XCTAssertTrue(unauthorized.value)
    }

    func testExtensionQueuesUntilLoginThenDrains() async throws {
        let defaults = UserDefaults(suiteName: #function)!; defaults.removePersistentDomain(forName: #function)
        let queue = ExtensionRetryQueue(storage: defaults)
        let coordinator = ExtensionAuthCoordinator(loginURL: URL(string: "nexus://login")!, queue: queue)
        let deepLink = URL(string: "nexus://resource/1")!
        let destination = await coordinator.destination(for: deepLink, isAuthenticated: false)
        XCTAssertEqual(destination, URL(string: "nexus://login"))
        let opened = URLRecorder()
        await coordinator.retry { await opened.append($0) }
        let openedValues = await opened.values()
        let pendingEntries = await queue.pending()
        XCTAssertEqual(openedValues, [deepLink]); XCTAssertTrue(pendingEntries.isEmpty)
    }

    func testMetadataCachePersistsStatus() async {
        let defaults = UserDefaults(suiteName: #function)!; defaults.removePersistentDomain(forName: #function)
        let cache = MetadataCache(storage: defaults)
        await cache.apply(status: .processing, resourceID: "r1")
        let cachedValue = await cache.value(for: "r1")
        XCTAssertEqual(cachedValue?.status, .processing)
        let reloaded = MetadataCache(storage: defaults)
        let reloadedValue = await reloaded.value(for: "r1")
        XCTAssertEqual(reloadedValue?.status, .processing)
    }
}

private actor URLRecorder {
    private var items: [URL] = []
    func append(_ url: URL) { items.append(url) }
    func values() -> [URL] { items }
}

private final class StubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let handler = Self.handler, let client else { return }
        let (response, data) = handler(request)
        client.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client.urlProtocol(self, didLoad: data)
        client.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private final class LockedFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var storage = false
    var value: Bool { lock.lock(); defer { lock.unlock() }; return storage }
    func setTrue() { lock.lock(); storage = true; lock.unlock() }
}
