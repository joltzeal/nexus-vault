import type { HistoryPage } from "./types"

type ApiEnvelope<T> = { data?: T; error?: { message?: string } | null; success?: boolean }

export type HistoryQuery = {
  cursor?: string
  entity?: string[]
  action?: string[]
  status?: string[]
  vaultId?: string
  q?: string
  from?: string
  to?: string
}

export async function listHistory(query: HistoryQuery = {}, signal?: AbortSignal): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: "10" })
  if (query.cursor) params.set("cursor", query.cursor)
  if (query.entity?.length) params.set("entity", query.entity.join(","))
  if (query.action?.length) params.set("action", query.action.join(","))
  if (query.status?.length) params.set("status", query.status.join(","))
  if (query.vaultId) params.set("vaultId", query.vaultId)
  if (query.q) params.set("q", query.q)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)

  const response = await fetch(`/api/v1/history?${params.toString()}`, { credentials: "include", signal })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<HistoryPage> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load history.")
  }
  return payload?.data ?? { items: [], nextCursor: null, hasMore: false }
}
