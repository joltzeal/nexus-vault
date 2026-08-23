import Foundation

@MainActor
final class ShareExtensionModel: ObservableObject {
    enum Phase {
        case loading
        case ready
        case saving
        case failed(String)
    }

    @Published var phase: Phase = .loading
    @Published var vaults: [VaultSummary] = []
    @Published var selectedVaultID = ""
    @Published var url = ""
    @Published var title = ""
    @Published var description = ""
    @Published var errorMessage: String?

    private weak var extensionContext: NSExtensionContext?

    init(extensionContext: NSExtensionContext?) {
        self.extensionContext = extensionContext
    }

    var canSave: Bool {
        if case .ready = phase {
            return !selectedVaultID.isEmpty && !url.isEmpty
        }
        return false
    }

    func load() async {
        phase = .loading
        errorMessage = nil
        do {
            let sharedContent = try await ShareContentExtractor.extract(from: extensionContext)
            let items = try await APIClient.shared.listVaults()

            url = sharedContent.url.absoluteString
            title = sharedContent.suggestedTitle
            vaults = items

            if let preferredID = AppGroup.selectedVaultID,
               items.contains(where: { $0.id == preferredID }) {
                selectedVaultID = preferredID
            } else {
                selectedVaultID = items.first?.id ?? ""
            }

            guard !items.isEmpty else {
                phase = .failed("还没有可用的 Vault，请先在 Web 端创建。")
                return
            }
            phase = .ready
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func save() async {
        guard canSave else { return }
        phase = .saving
        errorMessage = nil

        do {
            _ = try await APIClient.shared.createResource(
                ResourceInput(
                    vaultId: selectedVaultID,
                    url: url,
                    title: title.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                    description: description.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            if let vault = vaults.first(where: { $0.id == selectedVaultID }) {
                AppGroup.selectVault(vault)
            }
            extensionContext?.completeRequest(returningItems: nil)
        } catch {
            errorMessage = error.localizedDescription
            phase = .ready
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
