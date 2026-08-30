import Foundation

enum AppGroup {
    static let identifier = "group.space.stacklabs.nexusvault"
    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
    static var sharedDirectory: URL {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: identifier
        ) ?? FileManager.default.temporaryDirectory
    }
}
enum LinkParser {
    static func absoluteURL(_ value: String) -> URL? {
        if let url = URL(string: value), let scheme = url.scheme,
            ["http", "https"].contains(scheme.lowercased())
        {
            return url
        }
        if value.hasPrefix("/api/") {
            return URL(string: "https://nexus-vault.stacklabs.space\(value)")
        }
        return nil
    }
}
