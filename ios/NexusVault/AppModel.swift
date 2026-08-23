import Foundation

@MainActor
final class AppModel: ObservableObject {
    enum SessionState {
        case checking
        case signedOut
        case signedIn
    }

    @Published private(set) var sessionState: SessionState = .checking
    @Published private(set) var vaults: [VaultSummary] = []
    @Published private(set) var vaultDetails: [String: VaultDetailPayload] = [:]
    @Published private(set) var starredResources: [StarredResourceItem] = []
    @Published private(set) var readLaterResources: [ReadLaterResourceItem] = []
    @Published private(set) var isLoadingVaults = false
    @Published private(set) var isLoadingStarredResources = false
    @Published private(set) var isLoadingReadLaterResources = false
    @Published var errorMessage: String?

    init() {
        Task { await restoreSession() }
    }

    var selectedVaultID: String? {
        AppGroup.selectedVaultID
    }

    var selectedVaultTitle: String? {
        AppGroup.selectedVaultTitle
    }

    func signIn(email: String, password: String) async throws {
        try await APIClient.shared.signIn(email: email, password: password)
        try await loadVaults()
        sessionState = .signedIn
    }

    func signOut() async {
        await APIClient.shared.signOut()
        vaults = []
        vaultDetails = [:]
        starredResources = []
        readLaterResources = []
        sessionState = .signedOut
        errorMessage = nil
    }

    func loadVaults() async throws {
        isLoadingVaults = true
        defer { isLoadingVaults = false }

        do {
            let items = try await APIClient.shared.listVaults()
            vaults = items
            vaultDetails = vaultDetails.filter { detail in
                items.contains(where: { $0.id == detail.key })
            }
            if let selectedID = AppGroup.selectedVaultID,
               !items.contains(where: { $0.id == selectedID }) {
                AppGroup.selectedVaultID = nil
                AppGroup.selectedVaultTitle = nil
            }
            if AppGroup.selectedVaultID == nil, let first = items.first {
                AppGroup.selectVault(first)
            }
            errorMessage = nil
        } catch NexusAPIError.unauthorized {
            sessionState = .signedOut
            vaults = []
            throw NexusAPIError.unauthorized
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    func selectVault(_ vault: VaultSummary) {
        AppGroup.selectVault(vault)
        objectWillChange.send()
    }

    func vaultDetail(for vaultID: String) -> VaultDetailPayload? {
        vaultDetails[vaultID]
    }

    func applyAnnotation(_ annotation: ResourceAnnotation?, to resourceID: String) {
        for vaultID in Array(vaultDetails.keys) {
            guard let detail = vaultDetails[vaultID] else { continue }
            let resources = detail.resources.map { resource in
                resource.id == resourceID ? resource.replacingAnnotation(annotation) : resource
            }
            vaultDetails[vaultID] = VaultDetailPayload(
                vault: detail.vault,
                spaces: detail.spaces,
                resources: resources
            )
        }
    }

    func loadVaultDetail(for vaultID: String) async throws {
        let detail = try await APIClient.shared.vaultDetail(id: vaultID)
        vaultDetails[vaultID] = detail
    }

    func loadStarredResources() async throws {
        isLoadingStarredResources = true
        defer { isLoadingStarredResources = false }
        starredResources = try await APIClient.shared.listStarredResources()
    }

    func loadReadLaterResources() async throws {
        isLoadingReadLaterResources = true
        defer { isLoadingReadLaterResources = false }
        readLaterResources = try await APIClient.shared.listReadLaterResources()
    }

    private func restoreSession() async {
        do {
            try await loadVaults()
            sessionState = .signedIn
        } catch NexusAPIError.unauthorized {
            sessionState = .signedOut
        } catch {
            sessionState = .signedOut
            errorMessage = error.localizedDescription
        }
    }
}
