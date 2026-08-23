import Foundation

enum AppGroup {
    static let identifier = "group.com.nexusvault.shared"

    private enum Key {
        static let selectedVaultID = "selectedVaultID"
        static let selectedVaultTitle = "selectedVaultTitle"
    }

    static let productionBaseURL = URL(string: "https://nexus-vault.stacklabs.space")!

    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }

    static var baseURL: URL {
        productionBaseURL
    }

    static var selectedVaultID: String? {
        get { defaults.string(forKey: Key.selectedVaultID) }
        set { defaults.set(newValue, forKey: Key.selectedVaultID) }
    }

    static var selectedVaultTitle: String? {
        get { defaults.string(forKey: Key.selectedVaultTitle) }
        set { defaults.set(newValue, forKey: Key.selectedVaultTitle) }
    }

    static func selectVault(_ vault: VaultSummary) {
        selectedVaultID = vault.id
        selectedVaultTitle = vault.title
    }
}
