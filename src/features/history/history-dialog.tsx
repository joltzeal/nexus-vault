import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ListFilter, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/aicanvas/andromeda/components/Dialog"
import { Tooltip } from "@/components/aicanvas/andromeda/components/Tooltip"
import { DataTable } from "@/components/aicanvas/andromeda/components/DataTable"
import { Filters, createFilterQuery, flattenFilterConditions, type FilterField, type FilterQuery } from "@/components/reui/filters/filters"
import { Button } from "@/components/aicanvas/andromeda/components/Button"
import { Button as UiButton } from "@/components/ui/button"
import { listHistory, type HistoryQuery } from "./history-api"
import type { HistoryItem } from "./types"

type HistoryTableRow = Omit<HistoryItem, "source" | "target" | "details">

const ENTITY_OPTIONS = [
  { value: "vault", label: "Vault" },
  { value: "space", label: "Space" },
  { value: "resource", label: "Resource" },
  { value: "stash", label: "Flash stash" },
]
const ACTION_OPTIONS = [
  { value: "create", label: "Created" },
  { value: "add", label: "Added" },
  { value: "update", label: "Updated" },
  { value: "move", label: "Moved" },
  { value: "copy", label: "Copied" },
  { value: "delete", label: "Deleted" },
  { value: "reorder", label: "Reordered" },
  { value: "metadata", label: "Metadata" },
]
const STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function locationText(value: Record<string, unknown>) {
  const names = [value.vaultName, value.spaceName, value.stashUserId ? "Flash stash" : undefined]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
  if (names.length) return names.join(" / ")
  const ids = [value.vaultId, value.spaceId].filter((item): item is string => typeof item === "string" && item.length > 0)
  return ids.join(" / ") || "-"
}

function queryFromFilters(query: FilterQuery): HistoryQuery {
  const next: HistoryQuery = {}
  for (const condition of flattenFilterConditions(query)) {
    const values = condition.values.map(String).filter(Boolean)
    if (!values.length) continue
    if (condition.field === "entity") next.entity = values
    if (condition.field === "action") next.action = values
    if (condition.field === "status") next.status = values
    if (condition.field === "search" && condition.operator === "contains") next.q = values[0]
    if (condition.field === "createdAt") {
      if (["is_after", "is_on_or_after"].includes(condition.operator)) next.from = values[0]
      if (["is_before", "is_on_or_before"].includes(condition.operator)) next.to = values[0]
    }
  }
  return next
}

export function HistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [filterQuery, setFilterQuery] = useState<FilterQuery>(() => createFilterQuery())
  const [page, setPage] = useState({ items: [] as HistoryItem[], nextCursor: null as string | null, hasMore: false })
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<HistoryItem | null>(null)

  const fields = useMemo<FilterField[]>(() => [
    { id: "entity", label: "Entity", type: "multiselect", options: ENTITY_OPTIONS },
    { id: "action", label: "Action", type: "multiselect", options: ACTION_OPTIONS },
    { id: "status", label: "Status", type: "multiselect", options: STATUS_OPTIONS },
    { id: "search", label: "Object", type: "text", placeholder: "Search object", operators: [{ value: "contains", label: "contains" }] },
    { id: "createdAt", label: "Date", type: "text", placeholder: "YYYY-MM-DD", operators: [
      { value: "is_after", label: "after" },
      { value: "is_before", label: "before" },
      { value: "is_on_or_after", label: "on or after" },
      { value: "is_on_or_before", label: "on or before" },
    ] },
  ], [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    void listHistory(queryFromFilters(filterQuery), controller.signal)
      .then(setPage)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return
        setError(reason instanceof Error ? reason.message : "Could not load history.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [filterQuery, open])

  function applyFilterQuery(next: FilterQuery) {
    setFilterQuery(next)
    setCursorStack([])
  }

  async function goNext() {
    if (!page.nextCursor) return
    const next = await listHistory({ ...queryFromFilters(filterQuery), cursor: page.nextCursor })
    setCursorStack((current) => [...current, page.nextCursor!])
    setPage(next)
  }

  async function goPrevious() {
    const previous = cursorStack.at(-2)
    const next = await listHistory({ ...queryFromFilters(filterQuery), cursor: previous })
    setCursorStack((current) => current.slice(0, -1))
    setPage(next)
  }

  const tableRows = useMemo<HistoryTableRow[]>(() => page.items.map((item) => ({
    id: item.id,
    actorId: item.actorId,
    entityType: item.entityType,
    action: item.action,
    status: item.status,
    entityId: item.entityId,
    entityLabel: item.entityLabel,
    vaultId: item.vaultId,
    spaceId: item.spaceId,
    createdAt: item.createdAt,
  })), [page.items])
  const columns = useMemo(() => [
    { key: "createdAt", header: "Time", width: "10rem", primary: true, render: (row: HistoryTableRow) => formatDate(row.createdAt) },
    { key: "action", header: "Action", width: "6rem", render: (row: HistoryTableRow) => row.action.toUpperCase() },
    { key: "entityLabel", header: "Object", overflow: "visible", render: (row: HistoryTableRow) => <Tooltip label={row.entityLabel || row.entityId} style={{ zIndex: 1200 }}><span className="block max-w-[24rem] truncate">{row.entityLabel || row.entityId}</span></Tooltip>, fold: "meta", infoValue: (row: HistoryTableRow) => row.entityType },
    { key: "status", header: "Status", width: "6rem", render: (row: HistoryTableRow) => <span className={row.status === "failed" ? "text-destructive" : "text-emerald-500"}>{row.status.toUpperCase()}</span> },
  ], [])

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-6xl overflow-hidden p-0">
      <DialogHeader className="border-b border-border px-4 py-3">
        <DialogTitle className="flex items-center gap-2 text-base"><span className="text-primary">&gt;</span> History</DialogTitle>
        <button type="button" aria-label="Close history" className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-foreground" onClick={() => onOpenChange(false)}><X className="size-4" /></button>
      </DialogHeader>
      <div className="grid gap-3 p-4">
        <Filters
          fields={fields}
          menuClassName="z-[1200]"
          fieldPickerClassName="z-[1200]"
          query={filterQuery}
          onQueryChange={applyFilterQuery}
          showClear
          trigger={<UiButton aria-label="Filter history" size="sm" type="button" variant="outline"><ListFilter className="size-3.5" />Filter</UiButton>}
        />
        {error ? <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="py-10 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading history...</p> : null}
        {!loading && !error && page.items.length === 0 ? <p className="py-10 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">No history records.</p> : null}
        {!loading && page.items.length > 0 ? <DataTable columns={columns} rows={tableRows} getRowKey={(row) => row.id} onRowClick={(row) => setSelected(page.items.find((item) => item.id === row.id) ?? null)} /> : null}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="font-mono text-xs text-muted-foreground">{page.items.length} records</span>
          <div className="flex gap-1">
            <Button aria-label="Previous page" disabled={cursorStack.length === 0 || loading} icon={ChevronLeft} onClick={() => void goPrevious()} size="sm" type="button" variant="ghost" />
            <Button aria-label="Next page" disabled={!page.hasMore || loading} icon={ChevronRight} onClick={() => void goNext()} size="sm" type="button" variant="ghost" />
          </div>
        </div>
        {selected ? <div className="grid gap-3 border border-border bg-background p-3 text-sm"><div className="flex items-center justify-between border-b border-border pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"><span>Record details</span><button type="button" aria-label="Close details" onClick={() => setSelected(null)}><X className="size-3.5" /></button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><span className="block text-xs text-muted-foreground">Action</span><span className="font-mono uppercase">{selected.action}</span></div><div><span className="block text-xs text-muted-foreground">Status</span><span className={selected.status === "failed" ? "font-mono uppercase text-destructive" : "font-mono uppercase text-emerald-500"}>{selected.status}</span></div><div><span className="block text-xs text-muted-foreground">Entity</span><span className="font-mono uppercase">{selected.entityType}</span></div><div><span className="block text-xs text-muted-foreground">Time</span><span className="font-mono">{formatDate(selected.createdAt)}</span></div></div>{selected.details.resourceType ? <div className="border border-border p-2"><span className="block text-xs text-muted-foreground">Resource type</span><span className="font-mono uppercase">{String(selected.details.resourceType)}</span></div> : null}{selected.details.url ? <div className="border border-border p-2"><span className="block text-xs text-muted-foreground">Original URL</span><span className="break-all font-mono">{String(selected.details.url)}</span></div> : null}{locationText(selected.source) !== "-" ? <div className="border border-border p-2"><span className="block text-xs text-muted-foreground">From</span><span className="font-mono">{locationText(selected.source)}</span></div> : null}{locationText(selected.target) !== "-" ? <div className="border border-border p-2"><span className="block text-xs text-muted-foreground">To</span><span className="font-mono">{locationText(selected.target)}</span></div> : null}{selected.details.errorMessage ? <div className="border border-destructive/30 bg-destructive/10 p-2 text-destructive">{String(selected.details.errorMessage)}</div> : null}</div> : null}
      </div>
    </DialogContent>
  </Dialog>
}
