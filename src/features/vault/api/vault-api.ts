import type { VaultForm } from "../types"
import type { SpaceForm } from "@/features/space/types"
import type { Resource, ResourceForm } from "@/features/resource/types"

type CreateVaultResponse = {
  id: string
  defaultSpaceId: string
}

export type VaultDetail = {
  allowResourceMediaUpload?: boolean
  vault: {
    id: string
    title: string
    description: string
    cover: string
    ownerName: string | null
    visibility: "public" | "private" | "password"
    starCount: number
    forkCount: number
    collectionEnabled: boolean
    nsfwEnabled: boolean
  }
  spaces: Array<{ id: string; name: string; description: string; icon: string }>
  resources: Resource[]
  actorRole: "owner" | "editor" | "viewer" | "anonymous"
}

export async function getDashboardVaultDetail(vaultId: string, signal?: AbortSignal): Promise<VaultDetail> {
  const response = await fetch(`/api/v1/vaults/${encodeURIComponent(vaultId)}`, { credentials: "include", signal })
  const payload = (await response.json().catch(() => null)) as { data?: VaultDetail; error?: { message?: string } | null } | null
  if (!response.ok) throw new Error(payload?.error?.message ?? "Could not load vault.")
  if (!payload?.data) throw new Error("Vault response was empty.")
  return payload.data
}

async function mutateVault<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    credentials: "include",
    method,
  })
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string } | null } | null
  if (!response.ok) throw new Error(payload?.error?.message ?? "Vault update failed.")
  return payload?.data as T
}

export function updateDashboardVault(vaultId: string, form: VaultForm) {
  return mutateVault<{ id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}`, "PATCH", {
    cover: form.cover.trim(),
    description: form.description,
    title: form.name,
    visibility: form.visibility,
  })
}

export function updateDashboardVaultOptions(
  vaultId: string,
  patch: { collectionEnabled?: boolean; nsfwEnabled?: boolean },
) {
  return mutateVault<{ id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}`, "PATCH", patch)
}

export function deleteDashboardVault(vaultId: string) {
  return mutateVault<{ archived: boolean; id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}`, "DELETE")
}

export function createVaultSpace(vaultId: string, form: SpaceForm) {
  return mutateVault<{ id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}/spaces`, "POST", form)
}

export function createVaultResource(vaultId: string, form: ResourceForm) {
  return mutateVault<{ id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}/resources`, "POST", {
    description: form.description,
    extractionCode: form.extractionCode || undefined,
    spaceId: form.spaceId || undefined,
    title: form.title.trim() || undefined,
    url: form.url,
  })
}

export async function createDashboardVault(form: VaultForm): Promise<CreateVaultResponse> {
  const response = await fetch("/api/v1/vaults", {
    body: JSON.stringify({
      cover: form.cover.trim(),
      description: form.description,
      title: form.name,
      visibility: form.visibility,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  const payload = (await response.json().catch(() => null)) as
    | { data?: CreateVaultResponse; error?: { message?: string } | null }
    | null
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Could not create vault.")
  }
  return payload?.data ?? (payload as CreateVaultResponse)
}
