import Foundation

struct VaultSummary: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let description: String
    let resourceCount: Int
}

struct CreatedResource: Decodable, Sendable {
    let id: String
    let metadataStatus: String
}

struct APIEnvelope<Value: Decodable>: Decodable {
    let success: Bool
    let data: Value?
    let error: APIErrorPayload?
}

struct APIErrorPayload: Decodable {
    let code: String?
    let message: String
}

struct VaultListPayload: Decodable {
    let items: [VaultSummary]
}

struct VaultDetailPayload: Decodable, Sendable {
    let vault: VaultDetailVault
    let spaces: [VaultSpace]
    let resources: [VaultResource]
}

struct VaultDetailVault: Decodable, Sendable {
    let id: String
    let title: String
    let description: String
    let resourceCount: Int?
}

struct VaultSpace: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let icon: String?
    let position: Int?
}

struct VaultResource: Decodable, Identifiable, Sendable {
    let id: String
    let spaceId: String?
    let type: String
    let title: String
    let description: String
    let url: String?
    let metadataStatus: String
    let isStarred: Bool
    let isReadLater: Bool
    let position: Int?
    let createdAt: String
    let metadata: ResourceMetadataEnvelope?
    let annotation: ResourceAnnotation?

    enum CodingKeys: String, CodingKey {
        case id, spaceId, type, title, description, url, metadataStatus
        case isStarred, isReadLater, position, createdAt, metadata, annotation
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        spaceId = try container.decodeIfPresent(String.self, forKey: .spaceId)
        type = try container.decode(String.self, forKey: .type)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        url = try container.decodeIfPresent(String.self, forKey: .url)
        metadataStatus = try container.decodeIfPresent(String.self, forKey: .metadataStatus) ?? "pending"
        isStarred = try container.decodeIfPresent(Bool.self, forKey: .isStarred) ?? false
        isReadLater = try container.decodeIfPresent(Bool.self, forKey: .isReadLater) ?? false
        position = try container.decodeIfPresent(Int.self, forKey: .position)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        metadata = try container.decodeIfPresent(ResourceMetadataEnvelope.self, forKey: .metadata)
        annotation = try container.decodeIfPresent(ResourceAnnotation.self, forKey: .annotation)
    }

    init(
        id: String,
        spaceId: String?,
        type: String,
        title: String,
        description: String,
        url: String?,
        metadataStatus: String,
        isStarred: Bool,
        isReadLater: Bool,
        position: Int?,
        createdAt: String,
        metadata: ResourceMetadataEnvelope?,
        annotation: ResourceAnnotation? = nil
    ) {
        self.id = id
        self.spaceId = spaceId
        self.type = type
        self.title = title
        self.description = description
        self.url = url
        self.metadataStatus = metadataStatus
        self.isStarred = isStarred
        self.isReadLater = isReadLater
        self.position = position
        self.createdAt = createdAt
        self.metadata = metadata
        self.annotation = annotation
    }
}

struct ResourceAnnotation: Decodable, Sendable {
    let checked: Bool
    let rating: Int?
    let comment: String
    let createdAt: String?
    let updatedAt: String?
}

struct ResourceAnnotationPatch: Encodable {
    let checked: Bool
    let rating: Int?
    let comment: String
}

struct ResourceAnnotationResult: Decodable {
    let annotation: ResourceAnnotation?
}

extension VaultResource {
    func replacingAnnotation(_ annotation: ResourceAnnotation?) -> VaultResource {
        VaultResource(
            id: id,
            spaceId: spaceId,
            type: type,
            title: title,
            description: description,
            url: url,
            metadataStatus: metadataStatus,
            isStarred: isStarred,
            isReadLater: isReadLater,
            position: position,
            createdAt: createdAt,
            metadata: metadata,
            annotation: annotation
        )
    }
}

struct StarredResourcesPayload: Decodable {
    let items: [StarredResourceItem]
}

struct StarredResourceItem: Decodable, Identifiable {
    let id: String
    let sourceResourceId: String
    let type: String
    let title: String
    let description: String
    let url: String?
    let metadataStatus: String
    let metadataProvider: String?
    let metadataDataJson: ResourceMetadataData?
    let metadataErrorMessage: String?
    let sourceCreatedAt: String?
    let createdAt: String

    var resource: VaultResource {
        VaultResource(
            id: sourceResourceId,
            spaceId: nil,
            type: type,
            title: title,
            description: description,
            url: url,
            metadataStatus: metadataStatus,
            isStarred: true,
            isReadLater: false,
            position: nil,
            createdAt: sourceCreatedAt ?? createdAt,
            metadata: metadataProvider.map {
                ResourceMetadataEnvelope(
                    provider: $0,
                    data: metadataDataJson,
                    errorMessage: metadataErrorMessage,
                    updatedAt: nil
                )
            }
        )
    }
}

struct ReadLaterResourcesPayload: Decodable {
    let items: [ReadLaterResourceItem]
}

struct ReadLaterResourceItem: Decodable, Identifiable {
    let id: String
    let resourceId: String
    let vaultId: String
    let vaultName: String
    let spaceId: String
    let spaceName: String
    let savedAt: String
    let resource: VaultResource
}

struct ResourceMetadataEnvelope: Decodable, Sendable {
    let provider: String?
    let data: ResourceMetadataData?
    let errorMessage: String?
    let updatedAt: String?
}

struct ResourceMetadataData: Decodable, Sendable {
    let title: String?
    let description: String?
    let size: Int?
    let fileCount: Int?
    let fileType: String?
    let media: [ResourceMedia]?
    let preview: ResourcePreviewPayload?
    let source: ResourceSource?
    let extra: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case title, description, size, fileCount, fileType, media, preview, source, extra
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        size = ResourceMedia.flexibleInt(from: container, forKey: .size)
        fileCount = ResourceMedia.flexibleInt(from: container, forKey: .fileCount)
        fileType = try container.decodeIfPresent(String.self, forKey: .fileType)
        media = try container.decodeIfPresent([ResourceMedia].self, forKey: .media)
        preview = try container.decodeIfPresent(ResourcePreviewPayload.self, forKey: .preview)
        source = try container.decodeIfPresent(ResourceSource.self, forKey: .source)
        extra = try container.decodeIfPresent([String: JSONValue].self, forKey: .extra)
    }
}

struct ResourceMedia: Decodable, Identifiable, Sendable {
    let kind: String
    let url: String?
    let thumbnailURL: String?
    let previewURL: String?
    let alt: String?
    let duration: String?
    let width: Int?
    let height: Int?
    let size: Int?
    let fileName: String?
    let mimeType: String?
    let provider: String?
    let metadata: ResourceMediaMetadata?

    var id: String {
        [kind, previewURL ?? thumbnailURL ?? url ?? "", alt ?? ""].joined(separator: ":")
    }

    enum CodingKeys: String, CodingKey {
        case kind
        case url
        case thumbnailURL = "thumbnailUrl"
        case previewURL = "previewUrl"
        case alt
        case duration
        case width
        case height
        case size
        case fileName
        case mimeType
        case provider
        case metadata
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decode(String.self, forKey: .kind)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        thumbnailURL = try container.decodeIfPresent(String.self, forKey: .thumbnailURL)
        previewURL = try container.decodeIfPresent(String.self, forKey: .previewURL)
        alt = try container.decodeIfPresent(String.self, forKey: .alt)
        width = Self.flexibleInt(from: container, forKey: .width)
        height = Self.flexibleInt(from: container, forKey: .height)
        size = Self.flexibleInt(from: container, forKey: .size)
        fileName = try container.decodeIfPresent(String.self, forKey: .fileName)
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
        provider = try container.decodeIfPresent(String.self, forKey: .provider)
        metadata = try container.decodeIfPresent(ResourceMediaMetadata.self, forKey: .metadata)
        if let string = try? container.decodeIfPresent(String.self, forKey: .duration) {
            duration = string
        } else if let number = try? container.decodeIfPresent(Double.self, forKey: .duration) {
            let seconds = Int(number.rounded())
            duration = "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
        } else {
            duration = nil
        }
    }

    static func flexibleInt<Key: CodingKey>(
        from container: KeyedDecodingContainer<Key>,
        forKey key: Key
    ) -> Int? {
        if let value = try? container.decode(Int.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Double.self, forKey: key) {
            return Int(value.rounded())
        }
        if let value = try? container.decode(String.self, forKey: key) {
            return Int(value)
        }
        return nil
    }
}

struct ResourceMediaMetadata: Decodable, Sendable {
    let mediaType: String?
    let livePhoto: ResourceLivePhoto?

    enum CodingKeys: String, CodingKey {
        case mediaType
        case livePhoto
    }
}

struct ResourceLivePhoto: Decodable, Sendable {
    let url: String
    let duration: Double?
    let width: Int?
    let height: Int?

    enum CodingKeys: String, CodingKey {
        case url, duration, width, height
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try container.decode(String.self, forKey: .url)
        if let value = try? container.decodeIfPresent(Double.self, forKey: .duration) {
            duration = value
        } else if let value = try? container.decodeIfPresent(String.self, forKey: .duration) {
            duration = Double(value)
        } else {
            duration = nil
        }
        width = ResourceMedia.flexibleInt(from: container, forKey: .width)
        height = ResourceMedia.flexibleInt(from: container, forKey: .height)
    }
}

struct ResourcePreviewPayload: Decodable, Sendable {
    let kind: String
    let data: [String: JSONValue]
}

struct ResourceSource: Decodable, Sendable {
    let url: String?
    let attribution: JSONValue?
}

enum JSONValue: Decodable, Sendable {
    case string(String)
    case number(Double)
    case boolean(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .boolean(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    var stringValue: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }

    var numberValue: Double? {
        guard case let .number(value) = self else { return nil }
        return value
    }
}

struct ResourceInput: Encodable {
    let vaultId: String
    let url: String
    let title: String?
    let description: String
}

struct SignInInput: Encodable {
    let email: String
    let password: String
}

enum NexusAPIError: LocalizedError {
    case invalidServerURL
    case invalidResponse
    case unauthorized
    case server(message: String)
    case transport(message: String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL:
            return "服务器地址无效。"
        case .invalidResponse:
            return "服务器返回了无法识别的数据。"
        case .unauthorized:
            return "登录状态已失效，请重新登录。"
        case .server(let message), .transport(let message):
            return message
        }
    }
}
