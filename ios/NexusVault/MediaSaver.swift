import Foundation
import Photos
import UniformTypeIdentifiers

enum MediaSaver {
    static func save(url: URL) async throws {
        let data = try await MediaCache.shared.data(for: url)
        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent(
                url.lastPathComponent.isEmpty
                    ? UUID().uuidString : url.lastPathComponent
            )
        try data.write(to: temp, options: .atomic)
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw APIError.server("请允许访问照片以保存媒体")
        }
        try await PHPhotoLibrary.shared().performChanges {
            if let type = UTType(filenameExtension: temp.pathExtension),
                type.conforms(to: .movie)
            {
                PHAssetChangeRequest.creationRequestForAssetFromVideo(
                    atFileURL: temp
                )
            } else {
                PHAssetChangeRequest.creationRequestForAssetFromImage(
                    atFileURL: temp
                )
            }
        }
        try? FileManager.default.removeItem(at: temp)
    }
}
