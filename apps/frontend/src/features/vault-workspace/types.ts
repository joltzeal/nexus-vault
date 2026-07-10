import type { NormalizedResourceMetadata } from "@nexus-vault/shared/resource-metadata"

export type ResourceType =
  | "magnet"
  | "twitter"
  | "baidu_pan"
  | "quark_pan"
  | "onedrive"
  | "google_drive"
  | "dropbox"
  | "alist"
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

export type Resource = {
  id: string
  spaceId: string
  title: string
  type: ResourceType
  url: string
  description: string
  metadataStatus: MetadataStatus
  metadata?: ResourceMetadataEnvelope | null
  position: number
  createdAt: string
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
  ownerName: string
  visibility: Visibility
  collectionEnabled: boolean
  starCount: number
  forkCount: number
  isStarred?: boolean
  spaces: Space[]
  resources: Resource[]
  createdAt: string
}

export type ResourceSetForm = {
  name: string
  description: string
  visibility: Visibility
}

export type ResourceForm = {
  title: string
  spaceId: string
  url: string
  description: string
}

export type SpaceForm = {
  name: string
  description: string
}

export type AuthMode = "sign-in" | "sign-up"

export type AuthForm = {
  name: string
  email: string
  password: string
}

export type VaultWorkspaceInitialData = {
  sets: ResourceSet[]
  activeSetId: string
  actorEmail?: string
  actorName?: string | null
  error?: string
  shareSlug?: string
  turnstileSiteKey?: string
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
  metadataJson: string
  reviewNote: string
  reviewedAt?: string | null
  approvedResourceId?: string | null
  createdAt: string
  updatedAt: string
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
  { value: "baidu_pan", label: "Baidu Netdisk" },
  { value: "quark_pan", label: "Quark Cloud Drive" },
  { value: "onedrive", label: "OneDrive" },
  { value: "google_drive", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
  { value: "alist", label: "AList" },
  { value: "http", label: "HTTP/HTTPS" },
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
  visibility: "private",
}

export const emptyResourceForm: ResourceForm = {
  title: "",
  spaceId: "",
  url: "",
  description: "",
}

export const emptySpaceForm: SpaceForm = {
  name: "",
  description: "",
}

export const emptyAuthForm: AuthForm = {
  name: "",
  email: "",
  password: "",
}
