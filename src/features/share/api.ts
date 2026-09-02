import type { VaultDetail } from "@/features/vault/api/vault-api"

type ApiEnvelope<T> = { data?: T; error?: { message?: string } | null; success?: boolean }
export type SharedVaultResponse = { status: "unavailable" } | { status: "password" } | { status: "ready"; detail: VaultDetail }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers }, ...init })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message ?? `Request failed (${response.status})`)
  if (payload?.data === undefined) throw new Error("Response data was empty.")
  return payload.data
}

export function getSharedVault(shareSlug: string) { return request<SharedVaultResponse>(`/shares/${encodeURIComponent(shareSlug)}`) }
export function unlockSharedVault(shareSlug: string, passwordHash: string) { return request<VaultDetail>(`/shares/${encodeURIComponent(shareSlug)}/unlock`, { body: JSON.stringify({ passwordHash }), method: "POST" }) }
