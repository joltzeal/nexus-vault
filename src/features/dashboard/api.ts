export type DashboardVault = {
  id: string
  title: string
  description: string
  cover: string
  cardBackgroundImage: string | null
  resourceCount: number
  ownerName: string | null
  visibility: "public" | "private" | "password"
  role?: "editor" | "viewer"
}

type VaultListResponse = { items: DashboardVault[] }
type ApiResponse<T> = {
  data?: T
  error?: { message?: string } | null
  success?: boolean
}

export async function listDashboardVaults(signal?: AbortSignal): Promise<DashboardVault[]> {
  const response = await fetch("/api/v1/vaults", { credentials: "include", signal })
  const payload = (await response.json().catch(() => null)) as ApiResponse<VaultListResponse> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Failed to load vaults.")
  }
  return Array.isArray(payload?.data?.items) ? payload.data.items : []
}

async function listDashboardVaultCollection(
  path: string,
  signal?: AbortSignal,
): Promise<DashboardVault[]> {
  const response = await fetch(path, { credentials: "include", signal })
  const payload = (await response.json().catch(() => null)) as ApiResponse<VaultListResponse> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Failed to load vaults.")
  }
  return Array.isArray(payload?.data?.items) ? payload.data.items : []
}

export function listStarredDashboardVaults(signal?: AbortSignal) {
  return listDashboardVaultCollection("/api/v1/stars", signal)
}

export function listSharedDashboardVaults(signal?: AbortSignal) {
  return listDashboardVaultCollection("/api/v1/vaults/shared", signal)
}
