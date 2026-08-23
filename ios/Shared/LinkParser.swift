import Foundation

enum LinkParser {
    private static let preferredHosts = [
        "x.com",
        "twitter.com",
        "t.co",
        "douyin.com",
        "iesdouyin.com",
        "tiktok.com",
    ]

    static func firstURL(in text: String) -> URL? {
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }

        let urls = detector.matches(in: text, options: [], range: range).compactMap(\.url)
        return urls.first(where: isPreferredSocialURL) ?? urls.first
    }

    static func bestURL(from urls: [URL], text: String?) -> URL? {
        let textURL = text.flatMap(firstURL(in:))
        let candidates = urls + [textURL].compactMap { $0 }
        return candidates.first(where: isPreferredSocialURL) ?? candidates.first
    }

    static func suggestedTitle(from text: String?, url: URL) -> String {
        guard var value = text?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return ""
        }
        value = value.replacingOccurrences(of: url.absoluteString, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(value.prefix(200))
    }

    private static func isPreferredSocialURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return preferredHosts.contains { host == $0 || host.hasSuffix(".\($0)") }
    }
}
