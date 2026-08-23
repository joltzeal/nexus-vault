import Foundation
import UniformTypeIdentifiers

struct SharedContent {
    let url: URL
    let suggestedTitle: String
}

@MainActor
enum ShareContentExtractor {
    static func extract(from context: NSExtensionContext?) async throws -> SharedContent {
        guard let items = context?.inputItems as? [NSExtensionItem] else {
            throw ExtractionError.noContent
        }

        var urls: [URL] = []
        var textValues: [String] = []

        for item in items {
            if let attributedText = item.attributedContentText?.string,
               !attributedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                textValues.append(attributedText)
            }

            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let value = try? await loadItem(provider, typeIdentifier: UTType.url.identifier),
                   let url = url(from: value) {
                    urls.append(url)
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let value = try? await loadItem(provider, typeIdentifier: UTType.plainText.identifier),
                   let text = text(from: value) {
                    textValues.append(text)
                }
            }
        }

        let combinedText = textValues.joined(separator: "\n")
        guard let url = LinkParser.bestURL(from: urls, text: combinedText) else {
            throw ExtractionError.noURL
        }
        return SharedContent(
            url: url,
            suggestedTitle: LinkParser.suggestedTitle(from: combinedText, url: url)
        )
    }

    private static func loadItem(
        _ provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> NSSecureCoding? {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: item)
                }
            }
        }
    }

    private static func url(from value: NSSecureCoding?) -> URL? {
        if let value = value as? URL { return value }
        if let value = value as? NSURL { return value as URL }
        if let value = value as? String { return LinkParser.firstURL(in: value) }
        return nil
    }

    private static func text(from value: NSSecureCoding?) -> String? {
        if let value = value as? String { return value }
        if let value = value as? NSString { return value as String }
        if let value = value as? NSAttributedString { return value.string }
        return nil
    }
}

private enum ExtractionError: LocalizedError {
    case noContent
    case noURL

    var errorDescription: String? {
        switch self {
        case .noContent:
            return "没有读取到可分享的内容。"
        case .noURL:
            return "分享内容中没有可保存的链接。"
        }
    }
}
