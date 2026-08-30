import { useEffect, useState } from "react"
import { Archive, Eye, FolderKanban, LoaderCircle, Star, Users } from "lucide-react"
import { Link, useOutletContext } from "react-router-dom"

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/aicanvas/andromeda/components/Card"
import { toast } from "@/components/ui/toast"
import type { DashboardOutletContext } from "@/app/dashboard-shell"
import {
  listDashboardVaults,
  listSharedDashboardVaults,
  type DashboardVault,
} from "@/features/dashboard/api"
import type { DashboardView } from "@/features/dashboard/types"
import { useDocumentTitle } from "@/hooks/use-document-title"
import {
  ResourceCard,
} from "@/features/resource/components"
import {
  listReadLaterResources,
  listStarredResources,
  setResourceReadLater,
  setResourceStarred,
} from "@/features/resource/api"
import type {
  ReadLaterResourceItem,
  Resource,
  ResourceMetadataEnvelope,
  StarredResourceItem,
} from "@/features/resource/types"

const viewCopy: Record<
  DashboardView,
  { icon: typeof Archive; breadcrumb: string; title: string; body: string }
> = {
  "all-vaults": {
    icon: FolderKanban,
    breadcrumb: "~/workspace",
    title: "All vaults",
    body: "Your vault collection.",
  },
  "starred-vaults": {
    icon: Star,
    breadcrumb: "~/library",
    title: "Starred resources",
    body: "Resources you marked for quick access.",
  },
  "watch-later": {
    icon: Eye,
    breadcrumb: "~/library",
    title: "Watch later",
    body: "Resources saved for later.",
  },
  "shared-vaults": {
    icon: Users,
    breadcrumb: "~/collaboration",
    title: "Shared vaults",
    body: "Vaults that collaborators shared with you.",
  },
}

export function DashboardViewPage({ view }: { view: DashboardView }) {
  const copy = viewCopy[view]
  useDocumentTitle(`${copy.title} · Nexus Vault`)
  const [vaults, setVaults] = useState<DashboardVault[]>([])
  const [readLater, setReadLater] = useState<ReadLaterResourceItem[]>([])
  const [starred, setStarred] = useState<StarredResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingResourceId, setUpdatingResourceId] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const request =
      view === "all-vaults"
        ? listDashboardVaults(controller.signal).then(setVaults)
        : view === "shared-vaults"
          ? listSharedDashboardVaults(controller.signal).then(setVaults)
          : view === "starred-vaults"
            ? listStarredResources(controller.signal).then(setStarred)
            : listReadLaterResources(controller.signal).then(setReadLater)

    void request
      .then(() => setError(""))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "Could not load this page.")
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [view])

  async function updateStar(resource: Resource) {
    if (updatingResourceId) return
    try {
      setUpdatingResourceId(resource.id)
      await setResourceStarred(resource.id, !resource.isStarred)
      if (resource.isStarred) {
        setStarred((items) => items.filter((item) => item.sourceResourceId !== resource.id))
      } else {
        setReadLater((items) => items.map((item) =>
          item.resourceId === resource.id
            ? { ...item, resource: { ...item.resource, isStarred: true } }
            : item,
        ))
      }
      toast.add({
        title: resource.isStarred ? "Removed from starred" : "Resource starred",
        type: "success",
      })
    } catch (reason) {
      toast.add({
        title: reason instanceof Error ? reason.message : "Could not update resource.",
        type: "error",
      })
    } finally {
      setUpdatingResourceId("")
    }
  }

  async function updateReadLater(resource: Resource) {
    if (updatingResourceId) return
    try {
      setUpdatingResourceId(resource.id)
      await setResourceReadLater(resource.id, !resource.isReadLater)
      if (resource.isReadLater) {
        setReadLater((items) => items.filter((item) => item.resourceId !== resource.id))
        setStarred((items) => items.map((item) =>
          item.sourceResourceId === resource.id ? { ...item, isReadLater: false } : item,
        ))
      } else {
        setStarred((items) => items.map((item) =>
          item.sourceResourceId === resource.id ? { ...item, isReadLater: true } : item,
        ))
      }
      toast.add({
        title: resource.isReadLater ? "Removed from watch later" : "Saved to watch later",
        type: "success",
      })
    } catch (reason) {
      toast.add({
        title: reason instanceof Error ? reason.message : "Could not update resource.",
        type: "error",
      })
    } finally {
      setUpdatingResourceId("")
    }
  }

  const resourceEntries =
    view === "starred-vaults"
      ? starred.map(toStarredResourceEntry)
      : readLater.map(toReadLaterResourceEntry)

  return (
    <section className="mx-auto w-full max-w-[100rem]">
      <DashboardPageHeader
        breadcrumb={copy.breadcrumb}
        description={copy.body}
        title={copy.title}
      />
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          Loading...
        </div>
      ) : error ? (
        <EmptyState icon={copy.icon} message={error} title="Unable to load" />
      ) : view === "starred-vaults" || view === "watch-later" ? (
        resourceEntries.length > 0 ? (
          <DashboardResourceCards
            entries={resourceEntries}
            key={view}
            onToggleReadLater={updateReadLater}
            onToggleStar={updateStar}
            updatingResourceId={updatingResourceId}
          />
        ) : (
          <EmptyState
            icon={copy.icon}
            message={view === "starred-vaults" ? "Star a resource in any vault to find it here." : "Save a resource from any vault to find it here."}
            title="Nothing saved yet"
          />
        )
      ) : vaults.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {vaults.map((vault) => <VaultCard key={vault.id} vault={vault} />)}
        </div>
      ) : (
        <EmptyState icon={copy.icon} message={copy.body} title={`No ${copy.title.toLowerCase()} yet`} />
      )}
    </section>
  )
}

type DashboardResourceEntry = {
  id: string
  resource: Resource
  spaceId: string
  spaceName: string
  vaultId: string
  vaultName: string
}

function toReadLaterResourceEntry(item: ReadLaterResourceItem): DashboardResourceEntry {
  return {
    id: item.id,
    resource: item.resource,
    spaceId: item.spaceId || "unsorted",
    spaceName: item.spaceName,
    vaultId: item.vaultId,
    vaultName: item.vaultName,
  }
}

function toStarredResourceEntry(item: StarredResourceItem): DashboardResourceEntry {
  return {
    id: item.id,
    resource: {
      id: item.sourceResourceId,
      spaceId: item.sourceSpaceId ?? null,
      type: item.type,
      title: item.title,
      description: item.description,
      url: item.url,
      referer: item.referer,
      metadataStatus: item.metadataStatus,
      position: item.position ?? 0,
      createdAt: item.sourceCreatedAt ?? item.createdAt,
      updatedAt: item.resourceUpdatedAt,
      isReadLater: item.isReadLater,
      isStarred: true,
      metadata: item.metadataProvider
        ? {
            provider: item.metadataProvider,
            data: item.metadataDataJson as ResourceMetadataEnvelope["data"],
            errorMessage: item.metadataErrorMessage,
            updatedAt: item.metadataUpdatedAt,
          }
        : null,
    },
    spaceId: item.sourceSpaceId ?? "unsorted",
    spaceName: item.sourceSpaceName ?? "Unsorted",
    vaultId: item.sourceVaultId,
    vaultName: item.sourceVaultTitle ?? "Vault",
  }
}

function DashboardResourceCards({
  entries,
  onToggleReadLater,
  onToggleStar,
  updatingResourceId,
}: {
  entries: DashboardResourceEntry[]
  onToggleReadLater: (resource: Resource) => Promise<void>
  onToggleStar: (resource: Resource) => Promise<void>
  updatingResourceId: string
}) {
  const { mediaVisible } = useOutletContext<DashboardOutletContext>()

  return (
    <div className="grid gap-2">
      {entries.map((entry, index) => (
        <ResourceCard
          canDeleteResource={false}
          canEditResource={false}
          disabled={updatingResourceId === entry.resource.id}
          index={index}
          isActive={false}
          isSignedIn
          isVaultOwner={false}
          key={entry.id}
          mediaVisible={mediaVisible}
          onCreateTransferTargetSpace={() => undefined}
          onDelete={() => undefined}
          onLoadTransferTargets={() => Promise.resolve()}
          onOpenDetails={() => undefined}
          onToggleReadLater={() => void onToggleReadLater(entry.resource)}
          onToggleStar={() => void onToggleStar(entry.resource)}
          onTransferResource={() => Promise.resolve()}
          resource={entry.resource}
          showAnnotationActions={false}
          spaceId={entry.spaceId}
          spaceName={entry.spaceName}
          transferTargets={[]}
          vaultId={entry.vaultId}
          vaultName={entry.vaultName}
          viewMode="list"
        />
      ))}
    </div>
  )
}

function VaultCard({ vault }: { vault: DashboardVault }) {
  return (
    <Card bordered className="min-w-0 transition-colors hover:border-primary/60">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          {vault.cover?.startsWith("http://") || vault.cover?.startsWith("https://") ? (
            <img
              alt=""
              className="size-8 shrink-0 border border-border object-cover"
              src={vault.cover}
            />
          ) : vault.cover ? (
            <span
              aria-label={`${vault.title} cover`}
              className="grid size-8 shrink-0 place-items-center border border-border bg-background text-xl leading-none"
              role="img"
            >
              {vault.cover}
            </span>
          ) : (
            <span className="grid size-8 shrink-0 place-items-center border border-border bg-background text-primary">
              <FolderKanban className="size-4" />
            </span>
          )}
          <CardTitle className="min-w-0 truncate normal-case tracking-normal">{vault.title}</CardTitle>
        </div>
        {vault.role ? <span className="mono text-[10px] uppercase text-primary">{vault.role}</span> : null}
      </CardHeader>
      <CardContent className="grid min-h-24 gap-2">
        <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">
          {vault.description || "No description"}
        </p>
        <p className="mono text-[10px] uppercase text-muted-foreground">
          {vault.resourceCount ?? 0} resources{vault.ownerName ? ` · ${vault.ownerName}` : ""}
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <Link
          className="mono text-xs uppercase tracking-wide text-primary hover:text-foreground"
          to={`/dashboard/vault/${encodeURIComponent(vault.id)}`}
        >
          Open vault
        </Link>
      </CardFooter>
    </Card>
  )
}

function EmptyState({ icon: Icon, message, title }: { icon: typeof Archive; message: string; title: string }) {
  return (
    <Card bordered className="grid min-h-48 place-items-center">
      <CardContent className="grid max-w-sm justify-items-center gap-2 text-center">
        <Icon className="size-5 text-primary" />
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="text-sm leading-5 text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
