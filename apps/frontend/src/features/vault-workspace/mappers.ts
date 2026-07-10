import type {
  MetadataStatus,
  Resource,
  ResourceSet,
  ResourceType,
  Space,
  Visibility,
  ResourceMetadataEnvelope,
} from "@/features/vault-workspace/types"

type RawSpace = Omit<Space, "icon" | "position"> & {
  icon?: string
  position?: number
}

export function mapVaultListItem(item: {
  id: string
  title: string
  description: string
  ownerName?: string | null
  visibility: Visibility
  collectionEnabled?: boolean
  starCount?: number
  forkCount?: number
  createdAt: string
}): ResourceSet {
  return {
    id: item.id,
    name: item.title,
    description: item.description,
    ownerName: item.ownerName ?? "Unknown",
    visibility: item.visibility,
    collectionEnabled: item.collectionEnabled ?? false,
    starCount: item.starCount ?? 0,
    forkCount: item.forkCount ?? 0,
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
    ownerName?: string | null
    visibility: Visibility
    collectionEnabled?: boolean
    starCount?: number
    forkCount?: number
    createdAt: string
  }
  spaces: RawSpace[]
  resources: Array<{
    id: string
    spaceId: string | null
    title: string
    type: ResourceType
    url: string
    description: string
    metadataStatus: MetadataStatus
    metadata?: ResourceMetadataEnvelope | null
    position?: number
    createdAt: string
  }>
}): ResourceSet {
  return {
    id: detail.vault.id,
    name: detail.vault.title,
    description: detail.vault.description,
    ownerName: detail.vault.ownerName ?? "Unknown",
    visibility: detail.vault.visibility,
    collectionEnabled: detail.vault.collectionEnabled ?? false,
    starCount: detail.vault.starCount ?? 0,
    forkCount: detail.vault.forkCount ?? 0,
    spaces: detail.spaces.map((space) => ({
      ...space,
      icon: space.icon ?? "tv",
      position: space.position ?? 0,
    })),
    resources: detail.resources.map((resource) => ({
      ...resource,
      spaceId: resource.spaceId ?? "",
      position: resource.position ?? 0,
    })),
    createdAt: detail.vault.createdAt,
  }
}
