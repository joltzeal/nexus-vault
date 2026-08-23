import type {
  MetadataStatus,
  Resource,
  ResourceSet,
  ResourceType,
  Space,
  Visibility,
  ResourceMetadataEnvelope,
} from "@/features/types"

type RawSpace = Omit<Space, "icon" | "position"> & {
  icon?: string
  position?: number
}

export function mapVaultListItem(item: {
  id: string
  title: string
  description: string
  cover?: string | null
  ownerName?: string | null
  ownerId?: string | null
  visibility: Visibility
  collectionEnabled?: boolean
  nsfwEnabled?: boolean
  starCount?: number
  forkCount?: number
  resourceCount?: number
  createdAt: string
  actorRole?: "owner" | "editor" | "anonymous"
}): ResourceSet {
  return {
    id: item.id,
    name: item.title,
    description: item.description,
    cover: item.cover ?? "",
    ownerName: item.ownerName ?? "Unknown",
    ownerId: item.ownerId ?? null,
    visibility: item.visibility,
    collectionEnabled: item.collectionEnabled ?? false,
    nsfwEnabled: item.nsfwEnabled ?? true,
    starCount: item.starCount ?? 0,
    forkCount: item.forkCount ?? 0,
    resourceCount: item.resourceCount ?? 0,
    actorRole: item.actorRole,
    spaces: [],
    resources: [],
    createdAt: item.createdAt,
  }
}

export function mapVaultDetail(detail: {
  vault: {
    id: string
    title: string
    description: string
    cover?: string | null
    ownerName?: string | null
    ownerId?: string | null
    visibility: Visibility
    collectionEnabled?: boolean
    nsfwEnabled?: boolean
    starCount?: number
    forkCount?: number
    resourceCount?: number
    createdAt: string
  }
  actorRole?: "owner" | "editor" | "anonymous"
  spaces: RawSpace[]
  resources: Array<{
    id: string
    spaceId: string | null
    title: string
    type: ResourceType
    url: string | null
    referer?: string | null
    description: string
    metadataStatus: MetadataStatus
    metadata?: ResourceMetadataEnvelope | null
    isStarred?: boolean
    isReadLater?: boolean
    annotation?: Resource["annotation"]
    position?: number
    createdBy?: string | null
    createdAt: string
  }>
}): ResourceSet {
  return {
    id: detail.vault.id,
    name: detail.vault.title,
    description: detail.vault.description,
    cover: detail.vault.cover ?? "",
    ownerName: detail.vault.ownerName ?? "Unknown",
    ownerId: detail.vault.ownerId ?? null,
    visibility: detail.vault.visibility,
    collectionEnabled: detail.vault.collectionEnabled ?? false,
    nsfwEnabled: detail.vault.nsfwEnabled ?? true,
    starCount: detail.vault.starCount ?? 0,
    forkCount: detail.vault.forkCount ?? 0,
    resourceCount: detail.vault.resourceCount ?? detail.resources.length,
    actorRole: detail.actorRole,
    spaces: detail.spaces.map((space) => ({
      ...space,
      icon: space.icon ?? "tv",
      position: space.position ?? 0,
    })),
    resources: detail.resources.map((resource) => ({
      ...resource,
      spaceId: resource.spaceId ?? "",
      position: resource.position ?? 0,
      isStarred: resource.isStarred ?? false,
      isReadLater: resource.isReadLater ?? false,
      annotation: resource.annotation ?? null,
    })),
    createdAt: detail.vault.createdAt,
  }
}
