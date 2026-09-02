import { AlertCircle, Inbox, LoaderCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useNavigate } from "react-router-dom"
import { DragDropProvider } from "@dnd-kit/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ResourceCard } from "@/features/resource/components/resource-card"
import { ResourceSubmissionDialog } from "@/features/resource/components"
import { getSharedVault, unlockSharedVault, type SharedVaultResponse } from "@/features/share/api"
import { authClient } from "@/lib/auth"
import { forkDashboardVault, setVaultStarred } from "@/features/vault/api/vault-api"
import type { AuthMode } from "@/features/auth/components/auth-dialog"
import type { ResourceTransferTargetVault } from "@/features/resource/types"
import { SpaceSection } from "@/features/space/components"
import { VaultOutline, type VaultViewMode } from "@/features/vault/components/vault-outline"
import type { VaultDetail } from "@/features/vault/api/vault-api"
import { VaultHeader } from "@/features/vault/components/vault-header"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { toast } from "@/lib/toast"
import { SharedVaultPasswordGate } from "./shared-vault-password-gate"

const emptyTargets: ResourceTransferTargetVault[] = []

export function SharedVaultPage() {
  const { shareSlug, requestAuth } = useOutletContext<{ shareSlug?: string; requestAuth?: (mode: AuthMode) => void }>()
  const [state, setState] = useState<SharedVaultResponse | null>(null)
  const [error, setError] = useState("")
  const [unlocking, setUnlocking] = useState(false)
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const detail = state?.status === "ready" ? state.detail : null

  useDocumentTitle(detail?.vault.title ? `${detail.vault.title} · Shared` : "Shared vault · Nexus Vault")

  const load = useCallback(async () => {
    if (!shareSlug) { setState({ status: "unavailable" }); return }
    try {
      setError("")
      const nextState = await getSharedVault(shareSlug)
      setState(nextState)
      if (nextState.status === "ready" && window.location.search) {
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load this shared vault.") }
  }, [shareSlug])

  useEffect(() => { void load() }, [load])

  async function handleUnlock(password: string) {
    if (!shareSlug) return
    try {
      setUnlocking(true)
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
      const passwordHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
      const nextDetail = await unlockSharedVault(shareSlug, passwordHash)
      setState({ status: "ready", detail: nextDetail })
      window.history.replaceState({}, "", window.location.pathname)
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Invalid vault password.") }
    finally { setUnlocking(false) }
  }

  if (error) return <ShareError message={error} />
  if (!state) return <div className="grid min-h-[50dvh] place-items-center"><LoaderCircle className="size-5 animate-spin text-primary" /></div>
  if (state.status === "unavailable") return <ShareError message="This vault is private, unavailable, or does not exist." />
  if (state.status === "password") return <div className="grid min-h-[50dvh] place-items-center"><SharedVaultPasswordGate busy={unlocking} onSubmit={handleUnlock} /></div>
  if (!detail) return null

  return <SharedVaultContent detail={detail} shareSlug={shareSlug ?? ""} onSubmit={() => setSubmissionOpen(true)} submissionOpen={submissionOpen} onSubmissionChange={setSubmissionOpen} requestAuth={requestAuth} />
}

function SharedVaultContent({ detail, shareSlug, onSubmit, submissionOpen, onSubmissionChange, requestAuth }: { detail: VaultDetail; shareSlug: string; onSubmit: () => void; submissionOpen: boolean; onSubmissionChange: (open: boolean) => void; requestAuth?: (mode: AuthMode) => void }) {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [starred, setStarred] = useState(false)
  const [starCount, setStarCount] = useState(detail.vault.starCount)
  const [forking, setForking] = useState(false)
  const [mediaVisible, setMediaVisible] = useState(detail.vault.nsfwEnabled)
  const [viewMode, setViewMode] = useState<VaultViewMode>("list")
  const displayDetail = { ...detail, vault: { ...detail.vault, starCount } }

  async function handleStar() {
    if (!session.data) { requestAuth?.("sign-in"); return }
    if (starred) return
    try {
      await setVaultStarred(detail.vault.id, true)
      setStarred(true)
      setStarCount((count) => count + 1)
      toast.success("Vault starred")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not star this vault.") }
  }

  async function handleFork() {
    if (!session.data) { requestAuth?.("sign-in"); return }
    if (forking) return
    try {
      setForking(true)
      const result = await forkDashboardVault(detail.vault.id)
      toast.success("Vault forked")
      navigate(`/dashboard/vault/${result.id}`)
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Could not fork this vault.") }
    finally { setForking(false) }
  }

  return <section className="vault-detail-page">
    <VaultHeader disabled={forking} detail={displayDetail} isShareMode mediaVisible={mediaVisible} onForkVault={handleFork} onToggleMediaVisibility={setMediaVisible} onToggleStar={handleStar} />
    {detail.vault.collectionEnabled ? (
      <Card className="mt-3 w-full border-primary/40 bg-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-3 sm:flex-row sm:items-center">
          <div className="grid gap-1">
            <p className="font-mono text-xs font-semibold text-primary">Contribute to this vault</p>
            <p className="text-xs leading-5 text-muted-foreground">Submit a resource for the vault owner to review before publishing.</p>
          </div>
          <Button className="shrink-0" onClick={onSubmit} type="button">
            <Inbox data-icon="inline-start" /> Submit a resource
          </Button>
        </CardContent>
      </Card>
    ) : null}
    <DragDropProvider onDragEnd={() => undefined}>
      <div className="vault-detail-page__body">
      <main aria-label="Shared vault content" className="vault-detail-page__content">
        {detail.spaces.map((space, index) => <SpaceSection key={space.id} collapsed={false} disabled={false} index={index} resources={detail.resources.filter((resource) => resource.spaceId === space.id)} space={space} transferTargets={emptyTargets} viewMode={viewMode} renderResource={(resource, resourceIndex) => <ResourceCard canDeleteResource={false} canEditResource={false} disabled index={resourceIndex} isActive={false} isSignedIn={false} isVaultOwner={false} mediaVisible={mediaVisible} onCreateTransferTargetSpace={() => undefined} onDelete={() => undefined} onLoadTransferTargets={async () => undefined} onOpenDetails={() => undefined} onToggleStar={() => undefined} onTransferResource={async () => undefined} resource={resource} showAnnotationActions={false} showManagementActions={false} showReadLaterAction={false} showSelectionControl={false} showStarAction={false} spaceId={space.id} transferTargets={emptyTargets} vaultId={detail.vault.id} vaultName={detail.vault.title} spaceName={space.name} viewMode={viewMode} />} />)}
        {detail.spaces.length === 0 ? <div className="grid min-h-32 place-items-center border border-dashed border-border text-sm text-muted-foreground">No spaces in this vault.</div> : null}
      </main>
      <div className="flex min-w-0 flex-col gap-3">
        <VaultOutline detail={detail} disabled={false} onAddSpace={() => undefined} onViewModeChange={setViewMode} viewMode={viewMode} />
      </div>
      </div>
    </DragDropProvider>
    <ResourceSubmissionDialog onOpenChange={onSubmissionChange} open={submissionOpen} shareSlug={shareSlug} spaces={detail.spaces} />
  </section>
}

function ShareError({ message }: { message: string }) {
  return <section className="mx-auto grid min-h-[50dvh] w-full max-w-xl place-items-center"><Alert variant="destructive"><AlertCircle /><AlertTitle>Vault unavailable</AlertTitle><AlertDescription>{message}</AlertDescription></Alert></section>
}
