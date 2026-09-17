export type WorkspaceSearchResult = {
  vaults: Array<{
    id: string
    title: string
    description: string
    matchedFields: string[]
  }>
  spaces: Array<{
    id: string
    name: string
    description: string
    vaultId: string
    vaultTitle: string
    matchedFields: string[]
  }>
  resources: Array<{
    id: string
    title: string
    description: string
    url: string | null
    vaultId: string
    vaultTitle: string
    spaceId: string | null
    spaceName: string | null
    matchedFields: string[]
  }>
}

export async function searchWorkspace(query: string, signal?: AbortSignal): Promise<WorkspaceSearchResult> {
  const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { credentials: "include", signal, cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as { data?: WorkspaceSearchResult; error?: { message?: string }; success?: boolean } | null
  if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message ?? "Could not search workspace.")
  return payload?.data ?? { vaults: [], spaces: [], resources: [] }
}
