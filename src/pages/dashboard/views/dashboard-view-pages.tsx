import { useEffect, useState } from "react";
import { Archive, Eye, FolderKanban, Star, Users } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import {
  Card,
  CardContent,
} from "@/components/aicanvas/andromeda/components/Card";
import { toast } from "@/components/ui/toast";
import type { DashboardOutletContext } from "@/app/dashboard-shell";
import {
  listDashboardVaults,
  listSharedDashboardVaults,
  type DashboardVault,
} from "@/features/dashboard/api";
import type { DashboardView } from "@/features/dashboard/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ResourceCard } from "@/features/resource/components";
import {
  listReadLaterResources,
  listResourceTransferTargets,
  listStashResources,
  organizeStashResource,
  deleteResource,
  listStarredResources,
  setResourceReadLater,
  setResourceStarred,
} from "@/features/resource/api";
import type {
  ReadLaterResourceItem,
  Resource,
  ResourceMetadataEnvelope,
  ResourceTransferTargetVault,
  StarredResourceItem,
} from "@/features/resource/types";
import { Spinner } from "@/components/aicanvas/andromeda/components/Spinner";
import { Avatar } from "@/components/aicanvas/andromeda/components/Avatar";
import { ShaderBackground } from "@/components/motion/shader-background";

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
  "flash-stash": {
    icon: Archive,
    breadcrumb: "~/inbox",
    title: "Flash stash",
    body: "Resources waiting to be organized.",
  },
};

// Keep this fallback aligned with the semantic palette in index.css.
const VAULT_CARD_SHADER_COLORS = ["#3fd8b0", "#5cb9f0", "#e8b34a", "#f0697a"];

export function DashboardViewPage({ view }: { view: DashboardView }) {
  const copy = viewCopy[view];
  const { mediaVisible } = useOutletContext<DashboardOutletContext>();
  useDocumentTitle(`${copy.title} · Nexus Vault`);
  const [vaults, setVaults] = useState<DashboardVault[]>([]);
  const [readLater, setReadLater] = useState<ReadLaterResourceItem[]>([]);
  const [starred, setStarred] = useState<StarredResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingResourceId, setUpdatingResourceId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const request =
      view === "all-vaults"
        ? listDashboardVaults(controller.signal).then(setVaults)
        : view === "shared-vaults"
          ? listSharedDashboardVaults(controller.signal).then(setVaults)
          : view === "starred-vaults"
            ? listStarredResources(controller.signal).then(setStarred)
            : listReadLaterResources(controller.signal).then(setReadLater);

    void request
      .then(() => setError(""))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this page.",
          );
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [view]);

  async function updateStar(resource: Resource) {
    if (updatingResourceId) return;
    try {
      setUpdatingResourceId(resource.id);
      await setResourceStarred(resource.id, !resource.isStarred);
      if (resource.isStarred) {
        setStarred((items) =>
          items.filter((item) => item.sourceResourceId !== resource.id),
        );
      } else {
        setReadLater((items) =>
          items.map((item) =>
            item.resourceId === resource.id
              ? { ...item, resource: { ...item.resource, isStarred: true } }
              : item,
          ),
        );
      }
      toast.add({
        title: resource.isStarred ? "Removed from starred" : "Resource starred",
        type: "success",
      });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setUpdatingResourceId("");
    }
  }

  async function updateReadLater(resource: Resource) {
    if (updatingResourceId) return;
    try {
      setUpdatingResourceId(resource.id);
      await setResourceReadLater(resource.id, !resource.isReadLater);
      if (resource.isReadLater) {
        setReadLater((items) =>
          items.filter((item) => item.resourceId !== resource.id),
        );
        setStarred((items) =>
          items.map((item) =>
            item.sourceResourceId === resource.id
              ? { ...item, isReadLater: false }
              : item,
          ),
        );
      } else {
        setStarred((items) =>
          items.map((item) =>
            item.sourceResourceId === resource.id
              ? { ...item, isReadLater: true }
              : item,
          ),
        );
      }
      toast.add({
        title: resource.isReadLater
          ? "Removed from watch later"
          : "Saved to watch later",
        type: "success",
      });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setUpdatingResourceId("");
    }
  }

  const resourceEntries =
    view === "starred-vaults"
      ? starred.map(toStarredResourceEntry)
      : readLater.map(toReadLaterResourceEntry);

  return (
    <section className="mx-auto w-full max-w-[112rem]">
      <DashboardPageHeader
        breadcrumb={copy.breadcrumb}
        description={copy.body}
        title={copy.title}
      />
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner variant="accent" size="sm" label="Loading" />
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
            message={
              view === "starred-vaults"
                ? "Star a resource in any vault to find it here."
                : "Save a resource from any vault to find it here."
            }
            title="Nothing saved yet"
          />
        )
      ) : vaults.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {vaults.map((vault) => (
            <VaultCard
              key={vault.id}
              mediaVisible={mediaVisible}
              vault={vault}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={copy.icon}
          message={copy.body}
          title={`No ${copy.title.toLowerCase()} yet`}
        />
      )}
    </section>
  );
}

export function FlashStashPage() {
  const { mediaVisible } = useOutletContext<DashboardOutletContext>();
  useDocumentTitle("Flash stash · Nexus Vault");
  const [resources, setResources] = useState<Resource[]>([]);
  const [targets, setTargets] = useState<ResourceTransferTargetVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      listStashResources(controller.signal),
      listResourceTransferTargets(),
    ])
      .then(([items, transferTargets]) => {
        setResources(items);
        setTargets(transferTargets);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load flash stash.",
          );
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleOrganize(input: {
    action: "move" | "copy";
    resourceId: string;
    targetVaultId: string;
    targetSpaceId: string;
  }) {
    if (input.action !== "move") return;
    setBusyId(input.resourceId);
    try {
      await organizeStashResource(input.resourceId, {
        targetVaultId: input.targetVaultId,
        targetSpaceId: input.targetSpaceId,
      });
      setResources((items) =>
        items.filter((item) => item.id !== input.resourceId),
      );
      toast.add({ title: "Resource organized", type: "success" });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not organize resource.",
        type: "error",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(resourceId: string) {
    setBusyId(resourceId);
    try {
      await deleteResource(resourceId);
      setResources((items) => items.filter((item) => item.id !== resourceId));
      toast.add({ title: "Resource deleted", type: "success" });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not delete resource.",
        type: "error",
      });
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="mx-auto w-full max-w-[112rem]">
      <DashboardPageHeader
        breadcrumb="~/inbox"
        description="Resources waiting to be organized."
        title="Flash stash"
      />
      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner variant="accent" size="sm" label="Loading" />
          Loading...
        </div>
      ) : error ? (
        <EmptyState icon={Archive} message={error} title="Unable to load" />
      ) : resources.length === 0 ? (
        <EmptyState
          icon={Archive}
          message="Add a resource from the create menu to keep it here temporarily."
          title="Flash stash is empty"
        />
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 2xl:columns-4">
          {resources.map((resource, index) => (
            <div className="mb-3 break-inside-avoid" key={resource.id}>
              <ResourceCard
                canDeleteResource
                canEditResource={false}
                canTransferResource
                disabled={busyId === resource.id}
                index={index}
                isActive={false}
                isSignedIn
                isVaultOwner={false}
                mediaVisible={mediaVisible}
                onCreateTransferTargetSpace={() => undefined}
                onDelete={() => void handleDelete(resource.id)}
                onLoadTransferTargets={async () => {
                  setTargets(await listResourceTransferTargets());
                }}
                onOpenDetails={() => undefined}
                onToggleReadLater={() => void handleToggleReadLater(resource)}
                onToggleStar={() => void handleToggleStar(resource)}
                onTransferResource={handleOrganize}
                resource={resource}
                spaceId="flash-stash"
                spaceName="Unsorted"
                transferTargets={targets}
                vaultId="flash-stash"
                vaultName="Flash stash"
                viewMode="masonry"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );

  async function handleToggleStar(resource: Resource) {
    setBusyId(resource.id);
    try {
      await setResourceStarred(resource.id, !resource.isStarred);
      setResources((items) =>
        items.map((item) =>
          item.id === resource.id
            ? { ...item, isStarred: !resource.isStarred }
            : item,
        ),
      );
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleToggleReadLater(resource: Resource) {
    setBusyId(resource.id);
    try {
      await setResourceReadLater(resource.id, !resource.isReadLater);
      setResources((items) =>
        items.map((item) =>
          item.id === resource.id
            ? { ...item, isReadLater: !resource.isReadLater }
            : item,
        ),
      );
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setBusyId("");
    }
  }
}

type DashboardResourceEntry = {
  id: string;
  resource: Resource;
  spaceId: string;
  spaceName: string;
  vaultId: string;
  vaultName: string;
};

function toReadLaterResourceEntry(
  item: ReadLaterResourceItem,
): DashboardResourceEntry {
  return {
    id: item.id,
    resource: item.resource,
    spaceId: item.spaceId || "unsorted",
    spaceName: item.spaceName,
    vaultId: item.vaultId,
    vaultName: item.vaultName,
  };
}

function toStarredResourceEntry(
  item: StarredResourceItem,
): DashboardResourceEntry {
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
      updatedAt: item.resourceUpdatedAt ?? undefined,
      isReadLater: item.isReadLater,
      isStarred: true,
      metadata: item.metadataProvider
        ? {
            provider: item.metadataProvider,
            data: item.metadataDataJson as ResourceMetadataEnvelope["data"],
            errorMessage: item.metadataErrorMessage ?? undefined,
            updatedAt: item.metadataUpdatedAt,
          }
        : null,
    },
    spaceId: item.sourceSpaceId ?? "unsorted",
    spaceName: item.sourceSpaceName ?? "Unsorted",
    vaultId: item.sourceVaultId,
    vaultName: item.sourceVaultTitle ?? "Vault",
  };
}

function DashboardResourceCards({
  entries,
  onToggleReadLater,
  onToggleStar,
  updatingResourceId,
}: {
  entries: DashboardResourceEntry[];
  onToggleReadLater: (resource: Resource) => Promise<void>;
  onToggleStar: (resource: Resource) => Promise<void>;
  updatingResourceId: string;
}) {
  const { mediaVisible } = useOutletContext<DashboardOutletContext>();

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
  );
}

function VaultCard({
  mediaVisible,
  vault,
}: {
  mediaVisible: boolean;
  vault: DashboardVault;
}) {
  return (
    <Link
      aria-label={`Open ${vault.title}`}
      className="group block h-76 w-full overflow-hidden "
      to={`/dashboard/vault/${encodeURIComponent(vault.id)}`}
    >
      <div className="relative h-full overflow-hidden rounded-md border border-border bg-ink-900 transition-colors duration-300 group-hover:border-primary/70">
        {mediaVisible && vault.cardBackgroundImage ? (
          <img
            alt=""
            className="absolute inset-0 size-full scale-[1.03] object-cover blur-[3px] transition-[filter,transform] duration-300 ease-out group-hover:scale-100 group-hover:blur-[1px]"
            src={vault.cardBackgroundImage}
          />
        ) : (
          <ShaderBackground
            className="absolute inset-0 size-full"
            colorBack="#0c1116"
            colors={VAULT_CARD_SHADER_COLORS}
            softness={0.7}
            speed={0.4}
            variant="grain-gradient"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />

        <div className="absolute inset-x-0 top-0 flex min-w-0 items-center gap-2 p-4 text-white">
          <VaultCover cover={vault.cover} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {vault.title}
          </span>
          {vault.role ? (
            <span className="mono shrink-0 text-[10px] uppercase text-white/65">
              {vault.role}
            </span>
          ) : null}
        </div>

        <CardContent className="absolute inset-x-0 bottom-0 grid gap-2 p-4 text-white">
          {vault.description ? (
            <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-5 text-white/75">
              {vault.description}
            </p>
          ) : null}
          <div className="flex min-w-0 items-center justify-between gap-3 mono text-[10px] uppercase text-white/65">
            <span className="shrink-0">
              {vault.resourceCount ?? 0} resources
            </span>
            {vault.ownerName ? (
              <span className="truncate">{vault.ownerName}</span>
            ) : null}
          </div>
        </CardContent>
      </div>
    </Link>
  );
}

function VaultCover({ cover }: { cover: string }) {
  return (
    <Avatar
      className="border-white/25 bg-black/80 text-base text-white hover:scale-100"
      name={cover || "🗂️"}
      size="md"
      status="online"
      src={
        cover.startsWith("http://") || cover.startsWith("https://")
          ? cover
          : undefined
      }
    />
  );
}

function EmptyState({
  icon: Icon,
  message,
  title,
}: {
  icon: typeof Archive;
  message: string;
  title: string;
}) {
  return (
    <Card bordered className="grid min-h-48 place-items-center">
      <CardContent className="grid max-w-sm justify-items-center gap-2 text-center">
        <Icon className="size-5 text-primary" />
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="text-sm leading-5 text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
