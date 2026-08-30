import Foundation

struct APIEnvelope<T: Decodable>: Decodable { let items: T }

struct SessionUser: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
}
struct SessionResponse: Codable { let user: SessionUser? }

struct VaultSummary: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let cover: String?
    let ownerName: String?
    let visibility: String?
    let collectionEnabled: Bool?
    let nsfwEnabled: Bool?
    let starCount: Int?
    let forkCount: Int?
    let resourceCount: Int?
    let createdAt: String?
    let updatedAt: String?
}
struct VaultSpace: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let icon: String?
    let position: Int?
}
struct ResourceAnnotation: Codable {
    let checked: Bool?
    let rating: Int?
    let comment: String?
    let dataJson: [String: String]?
}
struct ResourceMetadata: Codable {
    let provider: String?
    let data: MetadataData?
    let errorMessage: String?
    let updatedAt: String?
}
struct MetadataData: Codable {
    let title: String?
    let description: String?
    let previewURL: String?
    let thumbnailURL: String?
    let media: [ResourceMedia]?
    let width: Int?
    let height: Int?
    let duration: String?
    enum CodingKeys: String, CodingKey {
        case title, description
        case previewURL = "previewUrl"
        case thumbnailURL = "thumbnailUrl"
        case media, width, height, duration
    }
    init(from decoder: Decoder) throws {
        guard let c = try? decoder.container(keyedBy: CodingKeys.self) else {
            title = nil
            description = nil
            previewURL = nil
            thumbnailURL = nil
            media = nil
            width = nil
            height = nil
            duration = nil
            return
        }
        title = try c.decodeIfPresent(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        previewURL = try c.decodeIfPresent(String.self, forKey: .previewURL)
        thumbnailURL = try c.decodeIfPresent(String.self, forKey: .thumbnailURL)
        media = try c.decodeIfPresent([ResourceMedia].self, forKey: .media)
        width = try c.decodeIfPresent(Int.self, forKey: .width)
        height = try c.decodeIfPresent(Int.self, forKey: .height)
        duration = try c.decodeIfPresent(String.self, forKey: .duration)
    }
}
struct ResourceMedia: Codable, Identifiable {
    let id: String
    let kind: String
    let url: String?
    let previewURL: String?
    let thumbnailURL: String?
    let mimeType: String?
    let width: Int?
    let height: Int?
    let fileName: String?
    let size: Int?
    let duration: String?
    enum CodingKeys: String, CodingKey {
        case id, kind, url
        case previewURL = "previewUrl"
        case thumbnailURL = "thumbnailUrl"
        case mimeType, width, height, fileName, size, duration
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id =
            try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "image"
        url = try c.decodeIfPresent(String.self, forKey: .url)
        previewURL = try c.decodeIfPresent(String.self, forKey: .previewURL)
        thumbnailURL = try c.decodeIfPresent(String.self, forKey: .thumbnailURL)
        mimeType = try c.decodeIfPresent(String.self, forKey: .mimeType)
        width = try c.decodeIfPresent(Int.self, forKey: .width)
        height = try c.decodeIfPresent(Int.self, forKey: .height)
        fileName = try c.decodeIfPresent(String.self, forKey: .fileName)
        size = try c.decodeIfPresent(Int.self, forKey: .size)
        duration = try c.decodeIfPresent(String.self, forKey: .duration)
    }
}
struct VaultResource: Codable, Identifiable {
    let id: String
    let spaceId: String?
    let type: String
    let title: String
    let description: String?
    let url: String?
    let referer: String?
    let metadataStatus: String?
    let position: Int?
    let createdAt: String?
    let updatedAt: String?
    let isStarred: Bool?
    let isReadLater: Bool?
    let annotation: ResourceAnnotation?
    let metadata: ResourceMetadata?
    var displayProvider: String {
        metadata?.provider?.uppercased() ?? type.uppercased()
    }
    var media: [ResourceMedia] { metadata?.data?.media ?? [] }
}
struct VaultDetailPayload: Codable {
    let vault: VaultSummary
    let spaces: [VaultSpace]
    let resources: [VaultResource]
}

struct CreateResourceRequest: Encodable {
    let vaultId: String
    let spaceId: String?
    let type: String?
    let title: String?
    let description: String
    let url: String
    let referer: String?
}
struct AnnotationPatch: Encodable {
    let checked: Bool?
    let rating: Int?
    let comment: String?
}

enum APIError: LocalizedError {
    case invalidURL
    case http(Int)
    case server(String)
    case decoding, unauthorized, offline
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "无效的服务器地址"
        case .http(let c): return "请求失败（\(c)）"
        case .server(let s): return s
        case .decoding: return "服务器返回格式无法识别"
        case .unauthorized: return "登录已失效，请重新登录"
        case .offline: return "网络不可用，请稍后重试"
        }
    }
}
