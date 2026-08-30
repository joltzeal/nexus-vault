"use client"

import { useState, type FormEvent } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import type { ResourceSubmissionForm } from "../types"
import { submitSharedResource } from "../api"

const emptyForm: ResourceSubmissionForm = { description: "", spaceId: "", title: "", url: "" }

export function ResourceSubmissionDialog({
  open,
  onOpenChange,
  shareSlug,
  spaces = [],
  turnstileToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareSlug: string
  spaces?: Array<{ id: string; name: string }>
  turnstileToken?: string
}) {
  const [form, setForm] = useState<ResourceSubmissionForm>(emptyForm)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.url.trim()) return
    try {
      setBusy(true)
      await submitSharedResource(shareSlug, { ...form, turnstileToken })
      toast.success("Resource submitted", { description: "The vault owner will review it." })
      setForm(emptyForm)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit resource.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a resource</DialogTitle>
          <DialogDescription>Share a link with this vault. It will be reviewed before publishing.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium">URL<Input autoFocus required onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} value={form.url} /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">Title<Input onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} /></label>
          {spaces.length > 0 ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="submission-space">Space</label>
              <Select onValueChange={(spaceId) => setForm((current) => ({ ...current, spaceId: spaceId ?? "" }))} value={form.spaceId}>
                <SelectTrigger id="submission-space"><SelectValue placeholder="Choose a space" /></SelectTrigger>
                <SelectContent>{spaces.map((space) => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : null}
          <Textarea aria-label="Description" placeholder="Optional description" rows={4} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={busy || !form.url.trim()} type="submit"><Send data-icon="inline-start" />{busy ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
