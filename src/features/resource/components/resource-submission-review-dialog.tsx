"use client"

import { useEffect, useState } from "react"
import { Check, ExternalLink, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { approveVaultResourceSubmission, listVaultResourceSubmissions, rejectVaultResourceSubmission } from "../api"
import type { ResourceSubmissionItem } from "../types"

export function ResourceSubmissionReviewDialog({
  open,
  onOpenChange,
  vaultId,
  spaces,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vaultId: string
  spaces: Array<{ id: string; name: string }>
  onChanged?: () => void
}) {
  const [items, setItems] = useState<ResourceSubmissionItem[]>([])
  const [selected, setSelected] = useState<ResourceSubmissionItem | null>(null)
  const [spaceId, setSpaceId] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void listVaultResourceSubmissions(vaultId, "pending", controller.signal)
      .then(setItems)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(error instanceof Error ? error.message : "Could not load submissions.")
      })
    return () => controller.abort()
  }, [open, vaultId])

  async function review(action: "approve" | "reject") {
    if (!selected) return
    try {
      setBusy(true)
      if (action === "approve") await approveVaultResourceSubmission(vaultId, selected.id, { note, spaceId: spaceId || selected.spaceId || undefined })
      else await rejectVaultResourceSubmission(vaultId, selected.id, { note })
      setItems((current) => current.filter((item) => item.id !== selected.id))
      setSelected(null)
      setNote("")
      setSpaceId("")
      onChanged?.()
      toast.success(action === "approve" ? "Submission approved" : "Submission rejected")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review submission.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100dvh-2rem))] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resource submissions</DialogTitle>
          <DialogDescription>Review links submitted to this vault before they become resources.</DialogDescription>
        </DialogHeader>
        {items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No pending submissions.</p> : (
          <div className="flex flex-col gap-2">
            {items.map((item) => <button className="flex min-w-0 flex-col gap-1 border border-border bg-card p-3 text-left transition hover:border-primary" key={item.id} onClick={() => { setSelected(item); setSpaceId(item.spaceId ?? "") }} type="button"><span className="truncate text-sm font-medium text-foreground">{item.title || item.url}</span><span className="truncate text-xs text-muted-foreground">{item.url}</span><span className="text-xs text-muted-foreground">{item.submitterName || item.submitterEmail || "Anonymous"} · {new Date(item.createdAt).toLocaleString()}</span></button>)}
          </div>
        )}
        {selected ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{selected.title || "Untitled resource"}</p><a className="flex min-w-0 items-center gap-1 truncate text-xs text-primary hover:underline" href={selected.url} rel="noreferrer" target="_blank">{selected.url}<ExternalLink className="size-3 shrink-0" /></a></div><Button aria-label="Close submission details" onClick={() => setSelected(null)} size="icon-sm" type="button" variant="ghost"><X /></Button></div>
            {selected.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p> : null}
            <Textarea aria-label="Review note" onChange={(event) => setNote(event.target.value)} placeholder="Optional review note" rows={3} value={note} />
            <DialogFooter>
              {spaces.length > 0 ? <Select onValueChange={(value) => setSpaceId(value ?? "")} value={spaceId}><SelectTrigger className="mr-auto"><SelectValue placeholder="Keep submitted space" /></SelectTrigger><SelectContent>{spaces.map((space) => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}</SelectContent></Select> : null}
              <Button disabled={busy} onClick={() => void review("reject")} type="button" variant="destructive"><X data-icon="inline-start" />Reject</Button>
              <Button disabled={busy} onClick={() => void review("approve")} type="button"><Check data-icon="inline-start" />Approve</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
