import CryptoKit
import Foundation
import SwiftUI

actor MediaCache {
    static let shared = MediaCache()
    private let directory: URL
    init() {
        directory = FileManager.default.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("NexusVaultMedia", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
    }
    func data(for url: URL) async throws -> Data {
        let file = directory.appendingPathComponent(Self.key(url))
        if let cached = try? Data(contentsOf: file) { return cached }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse,
            (200..<300).contains(http.statusCode),
            !(http.mimeType ?? "").contains("text/html")
        else {
            throw APIError.http(
                (response as? HTTPURLResponse)?.statusCode ?? -1
            )
        }
        try? data.write(to: file, options: .atomic)
        return data
    }
    private static func key(_ url: URL) -> String {
        SHA256.hash(data: Data(url.absoluteString.utf8)).map {
            String(format: "%02x", $0)
        }.joined()
    }
}

struct MediaViewer: View {
    let media: [ResourceMedia]
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            TabView {
                ForEach(media) { item in
                    if let s = item.url ?? item.previewURL,
                        let url = URL(string: s)
                    {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFit()
                            } else {
                                ProgressView()
                            }
                        }.tag(item.id)
                    }
                }
            }.tabViewStyle(.page).toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("关闭") { dismiss() }
                }
            }
        }
    }
}
