import Foundation
import Combine

@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var state: SessionState = .signedOut
    private let restore: @Sendable () async throws -> Session?
    private var task: Task<Void, Never>?

    public init(restore: @escaping @Sendable () async throws -> Session?) { self.restore = restore }

    public func restoreIfNeeded() {
        guard task == nil else { return }
        state = .restoring
        task = Task { [weak self] in
            guard let self else { return }
            do { state = (try await restore()).map(SessionState.authenticated) ?? .signedOut }
            catch { state = .failed(error.localizedDescription) }
            task = nil
        }
    }

    public func handleUnauthorized() {
        task?.cancel(); task = nil; state = .expired
    }

    public func handleForeground() { restoreIfNeeded() }

    public func signOut() { task?.cancel(); task = nil; state = .signedOut }
}

public actor MetadataCache {
    private var values: [String: ResourceMetadata]
    private let storage: UserDefaults
    private let prefix = "nexus-vault.metadata."
    private let storageKey = "nexus-vault.metadata.cache"

    public init(storage: UserDefaults = .standard) {
        self.storage = storage
        if let data = storage.data(forKey: storageKey),
           let loaded = try? Self.decoder.decode([String: ResourceMetadata].self, from: data) {
            self.values = loaded
            return
        }

        var loaded: [String: ResourceMetadata] = [:]
        let legacyPrefix = "nexus-vault.metadata."
        let keys = storage.dictionaryRepresentation().keys.filter { $0.hasPrefix(legacyPrefix) }
        for key in keys {
            if let data = storage.data(forKey: key), let value = try? Self.decoder.decode(ResourceMetadata.self, from: data) { loaded[value.resourceID] = value }
        }
        self.values = loaded
    }

    public func value(for resourceID: String) -> ResourceMetadata? { values[resourceID] }

    public func upsert(_ value: ResourceMetadata) {
        values[value.resourceID] = value
        persist()
    }

    public func apply(status: MetadataStatus, resourceID: String, data: [String: String] = [:], errorMessage: String? = nil) {
        var value = values[resourceID] ?? ResourceMetadata(resourceID: resourceID, status: status)
        value.status = status; value.data = data.isEmpty ? value.data : data; value.errorMessage = errorMessage; value.updatedAt = .now
        upsert(value)
    }

    public func remove(resourceID: String) {
        values.removeValue(forKey: resourceID)
        persist()
    }

    private func persist() {
        if let data = try? Self.encoder.encode(values) { storage.set(data, forKey: storageKey) }
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}

public actor ExtensionRetryQueue {
    public struct Entry: Codable, Equatable, Sendable {
        public let id: UUID
        public let deepLink: URL
        public var attempts: Int
        public let createdAt: Date
        public init(deepLink: URL, attempts: Int = 0, createdAt: Date = .now) { self.id = UUID(); self.deepLink = deepLink; self.attempts = attempts; self.createdAt = createdAt }
    }

    private var entries: [Entry] = []
    private let storage: UserDefaults
    private let key = "nexus-vault.extension.retry-queue"

    public init(storage: UserDefaults = .standard) {
        self.storage = storage
        if let data = storage.data(forKey: key), let loaded = try? JSONDecoder.nexus.decode([Entry].self, from: data) { entries = loaded }
    }

    public func enqueue(_ deepLink: URL) { entries.append(Entry(deepLink: deepLink)); persist() }
    public func pending() -> [Entry] { entries }

    public func drain(open: @Sendable (URL) async throws -> Void) async {
        while !entries.isEmpty {
            var entry = entries[0]
            do { try await open(entry.deepLink); entries.removeFirst(); persist() }
            catch { entry.attempts += 1; entries[0] = entry; persist(); break }
        }
    }

    private func persist() { storage.set(try? JSONEncoder.nexus.encode(entries), forKey: key) }
}

public struct ExtensionAuthCoordinator: Sendable {
    public let loginURL: URL
    public let queue: ExtensionRetryQueue
    public init(loginURL: URL, queue: ExtensionRetryQueue) { self.loginURL = loginURL; self.queue = queue }

    public func destination(for deepLink: URL, isAuthenticated: Bool) async -> URL {
        if isAuthenticated { return deepLink }
        await queue.enqueue(deepLink)
        return loginURL
    }

    public func retry(open: @Sendable (URL) async throws -> Void) async { await queue.drain(open: open) }
}
