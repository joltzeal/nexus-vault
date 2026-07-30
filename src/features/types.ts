import type { NormalizedResourceMetadata } from "@/domain/resources/metadata"

export type ResourceType =
  | "magnet"
  | "twitter"
  | "baidu_pan"
  | "pan_115"
  | "pan_123"
  | "quark_pan"
  | "uc_pan"
  | "xunlei_pan"
  | "pikpak"
  | "onedrive"
  | "google_drive"
  | "dropbox"
  | "alist"
  | "ftp"
  | "http"
  | "youtube"
  | "other"

export type Visibility = "public" | "private" | "password"

export type MetadataStatus = "pending" | "processing" | "completed" | "failed"

export type ResourceMetadataEnvelope = {
  provider: string
  data: NormalizedResourceMetadata | null
  errorMessage?: string | null
  updatedAt?: string | null
}

export type ResourceAnnotation = {
  checked: boolean
  rating?: number | null
  comment: string
  dataJson?: Record<string, unknown>
  createdAt?: string | null
  updatedAt?: string | null
}

export type ResourceAnnotationPatch = {
  checked?: boolean
  rating?: number | null
  comment?: string
  dataJson?: Record<string, unknown>
}

export type Resource = {
  id: string
  spaceId: string
  title: string
  type: ResourceType
  url: string
  description: string
  metadataStatus: MetadataStatus
  metadata?: ResourceMetadataEnvelope | null
  isStarred?: boolean
  isReadLater?: boolean
  annotation?: ResourceAnnotation | null
  position: number
  createdBy?: string | null
  createdAt: string
}

export type ResourceTransferTargetVault = {
  id: string
  title: string
  spaces: Array<{
    id: string
    name: string
    icon: string
  }>
}

export type Space = {
  id: string
  name: string
  description: string
  icon: string
  position: number
  createdAt: string
}

export type ResourceSet = {
  id: string
  name: string
  description: string
  cover: string
  ownerName: string
  ownerId?: string | null
  visibility: Visibility
  collectionEnabled: boolean
  nsfwEnabled: boolean
  starCount: number
  forkCount: number
  resourceCount: number
  isStarred?: boolean
  actorRole?: "owner" | "editor" | "anonymous"
  spaces: Space[]
  resources: Resource[]
  createdAt: string
}

export type ResourceSetForm = {
  name: string
  description: string
  cover: string
  visibility: Visibility
}

export type ResourceForm = {
  title: string
  spaceId: string
  url: string
  extractionCode: string
  description: string
}

export type SpaceForm = {
  name: string
  description: string
  icon: string
}

export type AuthMode = "sign-in" | "sign-up" | "forgot-password"

export type AuthForm = {
  name: string
  email: string
  password: string
}

export type VaultWorkspaceInitialData = {
  sets: ResourceSet[]
  activeSetId: string
  actorId?: string
  actorEmail?: string
  actorName?: string | null
  error?: string
  shareSlug?: string
  turnstileSiteKey?: string
  mode?: "workspace" | "share"
}

export type ResourceSubmissionStatus = "pending" | "approved" | "rejected"

export type ResourceSubmissionItem = {
  id: string
  vaultId: string
  spaceId?: string | null
  status: ResourceSubmissionStatus
  submitterName: string
  submitterEmail: string
  type: ResourceType
  title: string
  description: string
  url: string
  metadataJson: unknown
  reviewNote: string
  reviewedAt?: string | null
  approvedResourceId?: string | null
  createdAt: string
  updatedAt: string
}

export type StarredResourceItem = {
  id: string
  sourceResourceId: string
  sourceVaultId: string
  sourceSpaceId?: string | null
  sourceVaultTitle?: string
  sourceSpaceName?: string
  type: ResourceType
  title: string
  description: string
  url: string
  metadataStatus: MetadataStatus
  metadataProvider?: string | null
  metadataDataJson: unknown
  metadataErrorMessage?: string | null
  sourceCreatedAt?: string | null
  createdAt: string
}

export type ReadLaterResourceItem = {
  id: string
  resourceId: string
  vaultId: string
  vaultName: string
  spaceId: string
  spaceName: string
  savedAt: string
  resource: Resource
}

export type ApiResponse<T> =
  | {
      success: true
      data: T
      error: null
    }
  | {
      success: false
      data: null
      error: {
        code: string
        message: string
        details?: unknown
      }
    }

export const resourceTypes: Array<{ value: ResourceType; label: string }> = [
  { value: "magnet", label: "Magnet" },
  { value: "twitter", label: "X/Twitter" },
  { value: "baidu_pan", label: "百度网盘" },
  { value: "pan_115", label: "115 盘" },
  { value: "pan_123", label: "123 云盘" },
  { value: "quark_pan", label: "夸克网盘" },
  { value: "uc_pan", label: "UC 网盘" },
  { value: "xunlei_pan", label: "迅雷网盘" },
  { value: "pikpak", label: "PikPak" },
  { value: "onedrive", label: "OneDrive" },
  { value: "google_drive", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
  { value: "alist", label: "AList" },
  { value: "ftp", label: "FTP" },
  { value: "http", label: "Website" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Other" },
]

export const visibilityOptions: Array<{ value: Visibility; label: string }> = [
  { value: "private", label: "私有" },
  { value: "public", label: "公开" },
  { value: "password", label: "密码保护" },
]

export const emptySetForm: ResourceSetForm = {
  name: "",
  description: "",
  cover: "",
  visibility: "private",
}

export const emptyResourceForm: ResourceForm = {
  title: "",
  spaceId: "",
  url: "",
  extractionCode: "",
  description: "",
}

export const emptySpaceForm: SpaceForm = {
  name: "",
  description: "",
  icon: "tv",
}

export const emptyAuthForm: AuthForm = {
  name: "",
  email: "",
  password: "",
}
