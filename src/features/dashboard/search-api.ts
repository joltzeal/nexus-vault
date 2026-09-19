import type { Resource } from "@/features/resource/types"

export type WorkspaceSearchResult = {
  resources: Array<{
    resource: Resource
    vaultId: string
    vaultTitle: string
    spaceId: string | null
    spaceName: string | null
  }>
}

export async function searchWorkspace(query: string, signal?: AbortSignal): Promise<WorkspaceSearchResult> {
  const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { credentials: "include", signal, cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { data?: WorkspaceSearchResult; error?: { message?: string }; success?: boolean } | null
  if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message ?? "Could not search workspace.")
  return payload?.data ?? { resources: [] }
}
