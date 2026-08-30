import type { SpaceForm } from "../types"

type ApiPayload<T> = { data?: T; error?: { message?: string } | null }

async function mutateSpace<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    credentials: "include",
    method,
  })
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null
  if (!response.ok) throw new Error(payload?.error?.message ?? "Space update failed.")
  return payload?.data as T
}

export function updateVaultSpace(vaultId: string, spaceId: string, form: SpaceForm) {
  return mutateSpace<{ id: string }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}/spaces/${encodeURIComponent(spaceId)}`, "PATCH", form)
}

export function deleteVaultSpace(vaultId: string, spaceId: string) {
  return mutateSpace<{ id: string; archived: boolean }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}/spaces/${encodeURIComponent(spaceId)}`, "DELETE")
}

export function reorderVaultSpaces(vaultId: string, items: Array<{ id: string; position: number }>) {
  return mutateSpace<{ updated: number }>(`/api/v1/vaults/${encodeURIComponent(vaultId)}/spaces/reorder`, "PATCH", { items })
}

export function transferVaultSpace(
  vaultId: string,
  spaceId: string,
  targetVaultId: string,
) {
  return mutateSpace<{ id: string; vaultId: string }>(
    `/api/v1/vaults/${encodeURIComponent(vaultId)}/spaces/${encodeURIComponent(spaceId)}/transfer`,
    "POST",
    { targetVaultId },
  )
}
