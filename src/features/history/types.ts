export type HistoryItem = {
  id: string
  actorId: string | null
  entityType: string
  action: string
  status: "success" | "failed"
  entityId: string
  entityLabel: string
  vaultId: string | null
  spaceId: string | null
  source: Record<string, unknown>
  target: Record<string, unknown>
  details: Record<string, unknown>
  createdAt: string
}

export type HistoryPage = {
  items: HistoryItem[]
  nextCursor: string | null
  hasMore: boolean
}
