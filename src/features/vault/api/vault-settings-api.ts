import type { ResourceSubmissionItem, Visibility } from "@/features/resource/types"

type ApiEnvelope<T> = {
  data?: T
  error?: { message?: string } | null
  success?: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? `Request failed (${response.status})`)
  }
  if (payload?.data === undefined) throw new Error("Response data was empty.")
  return payload.data
}

export type VaultShare = {
  id?: string
  visibility: Visibility
  slug?: string
  token?: string
  createdAt?: string
  updatedAt?: string
}

export type VaultCollaborator = {
  id: string
  userId: string
  email: string
  name?: string | null
  role: "editor"
  createdAt: string
}

export type VaultExport = {
  format: "nexus-vault.v1"
  exportedAt?: string
  vault: Record<string, unknown>
  spaces: unknown[]
  resources: unknown[]
}

export function getVaultShare(vaultId: string, signal?: AbortSignal) {
  return request<{ share: VaultShare }>(`/vaults/${encodeURIComponent(vaultId)}/share`, { signal }).then(
    (result) => result.share,
  )
}

export function updateVaultShare(
  vaultId: string,
  input: { visibility: Visibility; passwordHash?: string | null },
) {
  return request<{ id: string; slug: string }>(`/vaults/${encodeURIComponent(vaultId)}/share`, {
    body: JSON.stringify(input),
    method: "PUT",
  })
}

export function listVaultCollaborators(vaultId: string, signal?: AbortSignal) {
  return request<{ items: VaultCollaborator[] }>(
    `/vaults/${encodeURIComponent(vaultId)}/collaborators`,
    { signal },
  ).then((result) => result.items)
}

export function removeVaultCollaborator(vaultId: string, collaboratorId: string) {
  return request<{ id: string; removed: boolean }>(
    `/vaults/${encodeURIComponent(vaultId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    { method: "DELETE" },
  )
}

export function listVaultSubmissions(vaultId: string, signal?: AbortSignal) {
  return request<{ items: ResourceSubmissionItem[] }>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions?status=pending`,
    { signal },
  ).then((result) => result.items)
}

export function approveVaultSubmission(vaultId: string, submissionId: string, spaceId?: string) {
  return request<{ id: string; status: string }>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions/${encodeURIComponent(submissionId)}/approve`,
    {
      body: JSON.stringify({ spaceId: spaceId || undefined }),
      method: "POST",
    },
  )
}

export function rejectVaultSubmission(vaultId: string, submissionId: string) {
  return request<{ id: string; status: string }>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions/${encodeURIComponent(submissionId)}/reject`,
    { body: JSON.stringify({}), method: "POST" },
  )
}

export function exportVault(vaultId: string) {
  return request<VaultExport>(`/vaults/${encodeURIComponent(vaultId)}/export`)
}

export function importVault(data: VaultExport) {
  return request<{ id: string; defaultSpaceId?: string }>("/vaults/import", {
    body: JSON.stringify({ data }),
    method: "POST",
  })
}

