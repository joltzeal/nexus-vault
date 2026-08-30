import { LockKeyhole } from "lucide-react"
import { useState } from "react"
import { useOutletContext } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResourceSubmissionDialog } from "@/features/resource/components"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function SharedVaultPage() {
  useDocumentTitle("Shared vault · Nexus Vault")
  const { shareSlug } = useOutletContext<{ shareSlug?: string }>()
  const [submissionOpen, setSubmissionOpen] = useState(false)

  return (
    <section className="grid min-h-[50dvh] place-items-center">
      <Card className="w-full max-w-xl border border-border">
        <CardContent className="grid gap-4 p-8 text-center">
          <LockKeyhole className="mx-auto size-6 text-primary" />
          <div className="grid gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Shared vault</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em]">Share access is ready.</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Vault detail content and visibility checks will be connected here.
            </p>
            {shareSlug ? <p className="font-mono text-[10px] text-muted-foreground">/{shareSlug}</p> : null}
            {shareSlug ? <Button className="mx-auto" onClick={() => setSubmissionOpen(true)} type="button">Submit a resource</Button> : null}
          </div>
        </CardContent>
      </Card>
      {shareSlug ? <ResourceSubmissionDialog onOpenChange={setSubmissionOpen} open={submissionOpen} shareSlug={shareSlug} /> : null}
    </section>
  )
}
