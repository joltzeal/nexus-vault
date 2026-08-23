declare const __NEXUS_VAULT_ORIGIN__: string

export const APP_ORIGIN = __NEXUS_VAULT_ORIGIN__

export const STORAGE_KEYS = {
  lastAuthState: "nexusVault:lastAuthState",
  preferredTarget: "nexusVault:preferredTarget",
} as const

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

export type TransferTargetVault = {
  id: string
  title: string
  spaces: Array<{
    id: string
    name: string
    icon: string
  }>
}

export type PreferredTarget = {
  vaultId: string
  spaceId: string
  vaultTitle: string
  spaceName: string
}

export type Viewer = {
  email: string
  id?: string
  image?: string | null
  name?: string | null
}

export type AuthState = {
  connected: boolean
  checkedAt: string
  targets: TransferTargetVault[]
  preferredTarget?: PreferredTarget
  viewer?: Viewer
}

export type ViewerState = {
  connected: boolean
  checkedAt: string
  viewer?: Viewer
}

export type ExtensionRequest =
  | { type: "GET_AUTH_STATE"; refresh?: boolean }
  | { type: "GET_VIEWER_STATE"; refresh?: boolean }
  | { type: "OPEN_LOGIN" }
  | {
      type: "SAVE_RESOURCE"
      description?: string
      referer?: string
      title?: string
      url: string
      vaultId: string
      spaceId: string
    }
  | { type: "SET_PREFERRED_TARGET"; target: PreferredTarget }

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; authRequired?: boolean }

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!value || typeof value !== "object") return false
  return typeof (value as { type?: unknown }).type === "string"
}

export function getTweetStatusUrl(input: string) {
  const url = new URL(input, "https://x.com")
  const segments = url.pathname.split("/").filter(Boolean)
  const statusIndex = segments.findIndex((segment) =>
    segment.toLowerCase() === "status" || segment.toLowerCase() === "statuses"
  )

  if (statusIndex < 1) return null
  const tweetId = segments[statusIndex + 1]
  if (!tweetId || !/^\d+$/.test(tweetId)) return null

  return `https://x.com/${segments[statusIndex - 1]}/status/${tweetId}`
}

export function findPreferredTarget(
  targets: TransferTargetVault[],
  preferred?: PreferredTarget,
) {
  if (preferred) {
    const vault = targets.find((item) => item.id === preferred.vaultId)
    const space = vault?.spaces.find((item) => item.id === preferred.spaceId)
    if (vault && space) {
      return {
        vaultId: vault.id,
        spaceId: space.id,
        vaultTitle: vault.title,
        spaceName: space.name,
      }
    }
  }

  const vault = targets.find((item) => item.spaces.length > 0)
  const space = vault?.spaces[0]
  return vault && space
    ? {
        vaultId: vault.id,
        spaceId: space.id,
        vaultTitle: vault.title,
        spaceName: space.name,
      }
    : undefined
}
