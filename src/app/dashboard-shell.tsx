import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { pinyin } from "pinyin-pro";

import {
  AnimatedSidebarInset,
  AnimatedSidebarProvider,
} from "@/components/motion/animated-sidebar";
import {
  CommandPalette,
  type CommandItem,
} from "@/components/motion/command-palette";
import { Toaster } from "@/components/ui/toast";
import type { DashboardVaultItem } from "@/features/dashboard/types";
import { DashboardSidebar } from "@/pages/dashboard/dashboard-sidebar";
import { listDashboardVaults } from "@/features/dashboard/api";
import {
  createDashboardVault,
  createVaultResource,
} from "@/features/vault/api";
import { CreateVaultDialog } from "@/features/vault/components";
import { CreateResourceDialog } from "@/features/resource/components";
import {
  createStashResource,
  listResourceTransferTargets,
} from "@/features/resource/api";
import {
  emptyResourceForm,
  type ResourceForm,
  type ResourceTransferTargetVault,
} from "@/features/resource/types";
import type { VaultForm } from "@/features/vault/types";
import { authClient } from "@/lib/auth";
import { toast } from "@/components/ui/toast";

const MEDIA_VISIBILITY_STORAGE_KEY = "nexus-vault:media-visible";
const DEFAULT_VAULT_COVERS = ["📁", "🗂️", "🧰", "📚", "🧭", "🪐", "🌿"];

function createInitialVaultForm(): VaultForm {
  return {
    cover:
      DEFAULT_VAULT_COVERS[
        Math.floor(Math.random() * DEFAULT_VAULT_COVERS.length)
      ],
    description: "",
    name: "",
    visibility: "private",
  };
}

function getInitialMediaVisibility() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MEDIA_VISIBILITY_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export type DashboardOutletContext = {
  mediaVisible: boolean;
  onMediaVisibleChange: (visible: boolean) => void;
  onVaultLoadingChange: (vaultId: string, loading: boolean) => void;
  onVaultStatusChange: (status: DashboardVaultStatus | null) => void;
  refreshVaults: () => Promise<void>;
  user?: { email: string; image?: string | null; name: string };
};

export type DashboardVaultStatus = {
  vaultId: string;
  resourceCount: number;
  onCreateResource?: () => void;
  resources: Array<{
    id: string;
    spaceName: string;
    title: string;
    url: string | null;
    onSelect: () => void;
  }>;
};

function resourceSearchKeywords(title: string, url: string | null) {
  return [title, url ?? ""].flatMap((value) => {
    if (!value) return [];
    const syllables = pinyin(value, { toneType: "none", type: "array" });
    return [value, syllables.join(""), syllables.map((syllable) => syllable[0]).join("")];
  });
}

export function DashboardShell({
  vaults = [],
}: {
  vaults?: DashboardVaultItem[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = authClient.useSession();
  const [loadedVaults, setLoadedVaults] =
    useState<DashboardVaultItem[]>(vaults);
  const [mediaVisible, setMediaVisible] = useState(getInitialMediaVisibility);
  const [loadingVaultId, setLoadingVaultId] = useState<string | null>(null);
  const [createVaultOpen, setCreateVaultOpen] = useState(false);
  const [createVaultBusy, setCreateVaultBusy] = useState(false);
  const [createResourceOpen, setCreateResourceOpen] = useState(false);
  const [createResourceBusy, setCreateResourceBusy] = useState(false);
  const [createResourceForm, setCreateResourceForm] =
    useState<ResourceForm>(emptyResourceForm);
  const [resourceTargets, setResourceTargets] = useState<
    ResourceTransferTargetVault[]
  >([]);
  const [resourceTargetsLoading, setResourceTargetsLoading] = useState(false);
  const [resourceTargetVaultId, setResourceTargetVaultId] = useState("");
  const [vaultStatus, setVaultStatus] = useState<DashboardVaultStatus | null>(null);
  const [createVaultForm, setCreateVaultForm] = useState<VaultForm>(
    createInitialVaultForm,
  );

  const refreshVaults = useCallback((signal?: AbortSignal) => {
    return listDashboardVaults(signal).then((items) => {
      setLoadedVaults(
        items.map((item) => ({
          id: item.id,
          title: item.title,
          cover: item.cover,
          resourceCount: item.resourceCount,
        })),
      );
    });
  }, []);

  const handleMediaVisibleChange = useCallback((visible: boolean) => {
    setMediaVisible(visible);
    try {
      window.localStorage.setItem(MEDIA_VISIBILITY_STORAGE_KEY, String(visible));
    } catch {
      // Keep the session state when browser storage is unavailable.
    }
  }, []);

  const handleVaultStatusChange = useCallback(
    (status: DashboardVaultStatus | null) => setVaultStatus(status),
    [],
  );
  const handleVaultLoadingChange = useCallback(
    (vaultId: string, loading: boolean) => {
      setLoadingVaultId((current) => {
        if (loading) return vaultId;
        return current === vaultId ? null : current;
      });
    },
    [],
  );
  const activeVaultId = location.pathname.match(
    /^\/dashboard\/vault\/([^/]+)/,
  )?.[1];
  const activeVaultStatus =
    activeVaultId && vaultStatus?.vaultId === activeVaultId ? vaultStatus : null;
  const selectedResourceTarget = resourceTargets.find(
    (target) => target.id === resourceTargetVaultId,
  );
  const loadResourceTargets = useCallback(async () => {
    setResourceTargetsLoading(true);
    try {
      const targets = await listResourceTransferTargets();
      const target = targets[0];
      setResourceTargets(targets);
      setResourceTargetVaultId(target?.id ?? "");
      setCreateResourceForm((form) => ({
        ...form,
        spaceId:
          target?.spaces.some((space) => space.id === form.spaceId)
            ? form.spaceId
            : target?.spaces[0]?.id ?? "",
      }));
    } catch (error) {
      toast.add({
        title:
          error instanceof Error
            ? error.message
            : "Could not load resource destinations.",
        type: "error",
      });
    } finally {
      setResourceTargetsLoading(false);
    }
  }, []);
  const openResourceDialog = useCallback(() => {
    if (activeVaultStatus?.onCreateResource) {
      activeVaultStatus.onCreateResource();
      return;
    }
    setCreateResourceOpen(true);
  }, [activeVaultStatus]);
  const resourceTotal = loadedVaults.reduce(
    (total, vault) => total + (vault.resourceCount ?? 0),
    0,
  );
  const resourceCommandItems = useMemo<CommandItem[]>(
    () =>
      activeVaultStatus?.resources.map((resource) => ({
        id: resource.id,
        label: resource.title,
        description: resource.url ?? undefined,
        badge: (
          <span className="max-w-28 truncate border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {resource.spaceName}
          </span>
        ),
        group: "Resources",
        keywords: resourceSearchKeywords(
          `${resource.title} ${resource.spaceName}`,
          resource.url,
        ),
        onSelect: resource.onSelect,
      })) ?? [],
    [activeVaultStatus],
  );

  useEffect(() => {
    if (!createResourceOpen) return;
    void loadResourceTargets();
  }, [createResourceOpen, loadResourceTargets]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select, [contenteditable=true]"))
      )
        return;

      if (event.key.toLocaleLowerCase() === "t") {
        event.preventDefault();
        handleMediaVisibleChange(!mediaVisible);
        return;
      }
      if (event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        openResourceDialog();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleMediaVisibleChange, mediaVisible, openResourceDialog]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshVaults(controller.signal).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        console.warn("Failed to load dashboard vaults.", error);
    });
    return () => controller.abort();
  }, [refreshVaults]);

  function handleCreateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createVaultForm.name.trim()) return;
    const form = {
      ...createVaultForm,
      cover: createVaultForm.cover || createInitialVaultForm().cover,
    };
    setCreateVaultOpen(false);
    setCreateVaultForm(createInitialVaultForm());
    setCreateVaultBusy(true);
    void createDashboardVault(form)
      .then((created) => {
        void refreshVaults().catch(() => undefined);
        toast.add({ title: "Vault created", type: "success" });
        navigate(`/dashboard/vault/${encodeURIComponent(created.id)}`);
      })
      .catch((error: unknown) => {
        toast.add({
          title:
            error instanceof Error ? error.message : "Could not create vault.",
          type: "error",
        });
      })
      .finally(() => setCreateVaultBusy(false));
  }

  function resetCreateResourceForm() {
    setCreateResourceForm(emptyResourceForm);
    setResourceTargetVaultId("");
  }

  function handleResourceVaultChange(vaultId: string) {
    const target = resourceTargets.find((item) => item.id === vaultId);
    setResourceTargetVaultId(vaultId);
    setCreateResourceForm((form) => ({
      ...form,
      spaceId: target?.spaces[0]?.id ?? "",
    }));
  }

  function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResourceTarget || !createResourceForm.spaceId) return;
    const vaultId = selectedResourceTarget.id;
    const form = createResourceForm;
    setCreateResourceOpen(false);
    resetCreateResourceForm();
    setCreateResourceBusy(true);
    void createVaultResource(vaultId, form)
      .then(() => {
        toast.add({ title: "Resource added", type: "success" });
      })
      .catch((error: unknown) => {
        toast.add({
          title:
            error instanceof Error ? error.message : "Could not add resource.",
          type: "error",
        });
      })
      .finally(() => setCreateResourceBusy(false));
  }

  function handleSaveResourceToStash() {
    if (!createResourceForm.url.trim()) return;
    const form = createResourceForm;
    setCreateResourceOpen(false);
    resetCreateResourceForm();
    setCreateResourceBusy(true);
    void createStashResource(form)
      .then(() => {
        toast.add({ title: "Resource added to flash stash", type: "success" });
        navigate("/dashboard/flash-stash");
      })
      .catch((error: unknown) => {
        toast.add({
          title: error instanceof Error ? error.message : "Could not add resource.",
          type: "error",
        });
      })
      .finally(() => setCreateResourceBusy(false));
  }

  const user = session.data?.user;
  return (
    <AnimatedSidebarProvider
      className="!h-dvh !min-h-0 !flex-col w-full min-w-0 overflow-clip"
      style={{ "--sidebar-width": "15.75rem", "--sidebar-width-icon": "4rem" }}
    >
      <div className="flex min-h-0 w-full flex-1">
        <DashboardSidebar
          loadingVaultId={loadingVaultId}
          mediaVisible={mediaVisible}
          onMediaVisibleChange={handleMediaVisibleChange}
          onVaultLoadingChange={handleVaultLoadingChange}
          onCreateVault={() => {
            setCreateVaultForm((form) =>
              form.cover
                ? form
                : { ...form, cover: createInitialVaultForm().cover },
            );
            setCreateVaultOpen(true);
          }}
          onCreateResource={openResourceDialog}
          onOpenSettings={() => navigate("/dashboard/settings")}
          onSignOut={() => void authClient.signOut()}
          user={
            user
              ? { email: user.email, image: user.image, name: user.name }
              : undefined
          }
          vaults={loadedVaults}
        />
        <AnimatedSidebarInset className="!h-full !min-h-0 overflow-clip">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="min-w-0 px-5 pb-8 pt-5 sm:px-8 sm:pb-10 sm:pt-8">
              <Outlet
                context={
                  {
                  mediaVisible,
                  onMediaVisibleChange: handleMediaVisibleChange,
                  onVaultLoadingChange: handleVaultLoadingChange,
                  onVaultStatusChange: handleVaultStatusChange,
                  refreshVaults: () => refreshVaults(),
                  user: user
                      ? { email: user.email, image: user.image, name: user.name }
                      : undefined,
                  } satisfies DashboardOutletContext
                }
              />
            </div>
          </main>
          <div
            className="pointer-events-none absolute inset-0 z-20"
            id="dashboard-resource-preview-rail-layer"
          />
        </AnimatedSidebarInset>
      </div>
      <footer className="flex h-7 w-full shrink-0 items-center justify-between border-t border-border bg-sidebar px-4 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2.5">
          <span>Vaults {loadedVaults.length}</span>
          <span aria-hidden="true" className="text-border">/</span>
          <span>Resources {resourceTotal}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="text-foreground">n</kbd>
            <span>Add resource</span>
          </span>
          <span aria-hidden="true" className="text-border">/</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="text-foreground">t</kbd>
            <span>NSFW {mediaVisible ? "on" : "off"}</span>
          </span>
          {activeVaultId ? (
            <>
              <span aria-hidden="true" className="text-border">/</span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="text-foreground">⌘K</kbd>
                <span>Search resources</span>
              </span>
            </>
          ) : null}
        </div>
      </footer>
      {activeVaultId ? (
        <CommandPalette
          emptyMessage="No matching resources in this Vault."
          items={resourceCommandItems}
          placeholder="Search resources by title or URL..."
        />
      ) : null}
      <CreateVaultDialog
        form={createVaultForm}
        isSubmitting={createVaultBusy}
        onFormChange={setCreateVaultForm}
        onOpenChange={setCreateVaultOpen}
        onSubmit={handleCreateVault}
        open={createVaultOpen}
      />
      <CreateResourceDialog
        form={createResourceForm}
        isSubmitting={createResourceBusy}
        onFormChange={setCreateResourceForm}
        onOpenChange={(open) => {
          setCreateResourceOpen(open);
          if (!open) resetCreateResourceForm();
        }}
        onSaveToFlashStash={handleSaveResourceToStash}
        onSubmit={handleCreateResource}
        onVaultChange={handleResourceVaultChange}
        open={createResourceOpen}
        spaces={[]}
        selectedVaultId={resourceTargetVaultId}
        vaults={resourceTargets}
        vaultsLoading={resourceTargetsLoading}
      />
      <Toaster />
    </AnimatedSidebarProvider>
  );
}
