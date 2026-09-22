/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/aicanvas/andromeda/components/Dialog";
import { toast } from "@/components/ui/toast";
import { ProgressBar } from "@/components/aicanvas/andromeda/components/ProgressBar";
import {
  CreateResourceDialog,
  ResourceSubmissionReviewDialog,
} from "@/features/resource/components";
import {
  ResourceCard,
  ResourceDetailsSheet,
  type ResourceDetailsMediaChange,
  type ResourceDetailsForm,
} from "@/features/resource/components";
import {
  deleteResource,
  getResource,
  listResources,
  listResourceTransferTargets,
  reorderVaultResources,
  resolveResourceMetadata,
  setResourceReadLater,
  setResourceStarred,
  transferResource,
  transferResources,
  updateResourceAnnotation,
  updateResourceDetails,
  updateLocalMediaResource,
  uploadLocalMediaResource,
} from "@/features/resource/api";
import {
  streamResourceAiSummary,
  type ResourceAiSummaryStreamUpdate,
} from "@/features/resource/api/resource-api";
import type { DashboardOutletContext } from "@/app/dashboard-shell";
import type { LocalMediaUploadProgress } from "@/features/resource/api/local-media-api";
import type {
  Resource,
  ResourceForm,
  ResourceTransferTargetVault,
} from "@/features/resource/types";
import { CreateSpaceDialog } from "@/features/space/components";
import { SpaceSection } from "@/features/space/components";
import {
  deleteVaultSpace,
  reorderVaultSpaces,
  transferVaultSpace,
  updateVaultSpace,
} from "@/features/space/api";
import type { SpaceForm } from "@/features/space/types";
import {
  createVaultResource,
  createVaultSpace,
  deleteDashboardVault,
  getDashboardVaultDetail,
  updateDashboardVaultOptions,
  type VaultDetail,
  updateDashboardVault,
} from "@/features/vault/api";
import {
  approveVaultSubmission,
  exportVault,
  getVaultShare,
  importVault,
  listVaultCollaborators,
  listVaultSubmissions,
  removeVaultCollaborator,
  rejectVaultSubmission,
  updateVaultShare,
  type VaultCollaborator,
  type VaultExport,
  type VaultShare,
} from "@/features/vault/api/vault-settings-api";
import {
  CreateVaultDialog,
  VaultHeader,
  VaultOutline,
  // VaultResourcePreviewRail,
  VaultSettingsSheet,
  type SettingsTab,
} from "@/features/vault/components";
import type { VaultForm } from "@/features/vault/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Spinner } from "@/components/aicanvas/andromeda/components/Spinner";
import "@/features/vault/styles/vault-detail-layout.css";

const Button: any = ButtonPrimitive;

const AI_SUMMARY_POLL_INTERVAL_MS = 500;
const METADATA_POLL_INTERVAL_MS = 2500;
const RESOURCE_PAGE_LIMIT = 20;

type ResourcePageState = {
  complete: boolean;
  error?: string;
  loaded: boolean;
  loading: boolean;
  nextCursor?: string | null;
};

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    mediaVisible,
    onVaultLoadingChange,
    onVaultStatusChange,
    onResourceViewModeChange,
    refreshVaults,
    resourceViewMode: viewMode,
  } = useOutletContext<DashboardOutletContext>();
  const [detail, setDetail] = useState<VaultDetail | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcePages, setResourcePages] = useState<
    Record<string, ResourcePageState>
  >({});
  const detailRevisionRef = useRef(0);
  const detailLoadIdRef = useRef(0);
  const loadRequestRef = useRef(0);
  const resourceLoadVersionRef = useRef(0);
  const resourcePagesRef = useRef<Record<string, ResourcePageState>>({});
  const aiSummaryStreamsRef = useRef(new Map<string, AbortController>());
  const aiSummaryStreamFallbacksRef = useRef(new Set<string>());
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("share");
  const [share, setShare] = useState<VaultShare>({ visibility: "private" });
  const [sharePassword, setSharePassword] = useState("");
  const [collaborators, setCollaborators] = useState<VaultCollaborator[]>([]);
  const [submissions, setSubmissions] = useState<
    import("@/features/resource/types").ResourceSubmissionItem[]
  >([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [resourceEditOpen, setResourceEditOpen] = useState(false);
  const [resourceToEdit, setResourceToEdit] = useState<Resource | undefined>();
  const [editSpaceOpen, setEditSpaceOpen] = useState(false);
  const [spaceToEdit, setSpaceToEdit] = useState<{
    id: string;
    name: string;
    description: string;
    icon: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadInProgressRef = useRef(false);
  const [vaultForm, setVaultForm] = useState<VaultForm>({
    cover: "",
    description: "",
    name: "",
    visibility: "private",
  });
  const [spaceForm, setSpaceForm] = useState<SpaceForm>({
    description: "",
    icon: "tv",
    name: "",
  });
  const [resourceForm, setResourceForm] = useState<ResourceForm>({
    description: "",
    extractionCode: "",
    referer: "",
    spaceId: "",
    title: "",
    url: "",
  });
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(
    new Set(),
  );
  const allSpacesCollapsed =
    Boolean(detail?.spaces.length) &&
    detail?.spaces.every((space) => collapsedSpaceIds.has(space.id));
  const [selectionSpaceId, setSelectionSpaceId] = useState<string | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(
    new Set(),
  );
  const [transferTargets, setTransferTargets] = useState<
    ResourceTransferTargetVault[]
  >([]);
  const [transferFocusSpaceId, setTransferFocusSpaceId] = useState<string>();
  const [targetSpaceVaultId, setTargetSpaceVaultId] = useState<string>();

  const handleViewModeChange = onResourceViewModeChange;

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!uploadInProgressRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useDocumentTitle(
    detail?.vault.title
      ? `${detail.vault.title} · Nexus Vault`
      : "Vault · Nexus Vault",
  );

  const loadDetail = useCallback(
    (
      signal?: AbortSignal,
      options: { resetResources?: boolean } = {},
    ) => {
      if (!vaultId) return Promise.resolve();
      const revision = detailRevisionRef.current;
      const loadId = ++detailLoadIdRef.current;
      return getDashboardVaultDetail(vaultId, signal).then((nextDetail) => {
        if (
          revision !== detailRevisionRef.current ||
          loadId !== detailLoadIdRef.current
        )
          return;
        resourceLoadVersionRef.current += 1;
        const resetResources = options.resetResources ?? true;
        const validSpaceIds = new Set(nextDetail.spaces.map((space) => space.id));
        const nextPages = Object.fromEntries(
          nextDetail.spaces.map((space) => [space.id, resetResources
            ? {
              complete: space.resourceCount === 0,
              loaded: space.resourceCount === 0,
              loading: false,
              nextCursor: null,
            }
            : {
                ...(resourcePagesRef.current[space.id] ?? {
                  complete: space.resourceCount === 0,
                  loaded: space.resourceCount === 0,
                  nextCursor: null,
                }),
                loading: false,
              }]),
        );
        resourcePagesRef.current = nextPages;
        setResourcePages(nextPages);
        setResources((current) =>
          resetResources
            ? []
            : current.filter((resource) =>
                resource.spaceId ? validSpaceIds.has(resource.spaceId) : false,
              ),
        );
        setDetail(nextDetail);
        setError("");
      });
    },
    [vaultId],
  );

  const loadResourceSpacePage = useCallback(async (spaceId: string) => {
    if (!vaultId) return;
    const currentPage = resourcePagesRef.current[spaceId];
    if (!currentPage || currentPage.loading || currentPage.complete) return;
    const loadVersion = resourceLoadVersionRef.current;
    const loadingPages = {
      ...resourcePagesRef.current,
      [spaceId]: { ...currentPage, error: undefined, loading: true },
    };
    resourcePagesRef.current = loadingPages;
    setResourcePages(loadingPages);
    try {
      const page = await listResources({
        cursor: currentPage.nextCursor ?? undefined,
        limit: RESOURCE_PAGE_LIMIT,
        spaceId,
      });
      if (loadVersion !== resourceLoadVersionRef.current) return;
      setResources((current) => {
        const incomingIds = new Set(page.items.map((resource) => resource.id));
        return [
          ...current.filter((resource) => !incomingIds.has(resource.id)),
          ...page.items,
        ];
      });
      const nextPages = { ...resourcePagesRef.current };
      nextPages[spaceId] = {
        complete: page.nextCursor === null,
        loaded: true,
        loading: false,
        nextCursor: page.nextCursor,
      };
      resourcePagesRef.current = nextPages;
      setResourcePages(nextPages);
    } catch (reason) {
      if (loadVersion !== resourceLoadVersionRef.current) return;
      const nextPages = { ...resourcePagesRef.current };
      nextPages[spaceId] = {
        ...nextPages[spaceId],
        error:
          reason instanceof Error
            ? reason.message
            : "Could not load resources.",
        loading: false,
      };
      resourcePagesRef.current = nextPages;
      setResourcePages(nextPages);
    }
  }, [vaultId]);

  const refreshResource = useCallback(
    async (resourceId: string, options: { addIfMissing?: boolean } = {}) => {
      const nextResource = await getResource(resourceId);
      setResources((current) => {
        const exists = current.some(
          (resource) => resource.id === resourceId,
        );
        if (!exists && !options.addIfMissing) return current;
        return exists
          ? current.map((resource) =>
              resource.id === resourceId ? nextResource : resource,
            )
          : [...current, nextResource];
      });
      return nextResource;
    },
    [],
  );

  const refreshResources = useCallback(
    (resourceIds: Iterable<string>) =>
      Promise.all(
        [...new Set(resourceIds)].map((resourceId) =>
          refreshResource(resourceId),
        ),
      ),
    [refreshResource],
  );

  const applyAiSummaryStreamUpdate = useCallback(
    (update: ResourceAiSummaryStreamUpdate) => {
      setResources((current) => {
        const resource = current.find(
          (item) => item.id === update.id,
        );
        if (!resource) return current;

        const nextMetadata = resource.metadata?.data
          ? {
              ...resource.metadata,
              data: {
                ...resource.metadata.data,
                extra: {
                  ...resource.metadata.data.extra,
                  ...(update.aiSummary ? { aiSummary: update.aiSummary } : {}),
                },
              },
            }
          : resource.metadata;

        return current.map((item) =>
          item.id === update.id
            ? {
                ...item,
                description: update.description,
                metadata: nextMetadata,
                metadataStatus: update.metadataStatus,
              }
            : item,
        );
      });
    },
    [],
  );

  const startAiSummaryStream = useCallback(
    (resourceId: string) => {
      if (aiSummaryStreamsRef.current.has(resourceId)) return;

      const controller = new AbortController();
      aiSummaryStreamsRef.current.set(resourceId, controller);
      void streamResourceAiSummary(resourceId, {
        onUpdate: applyAiSummaryStreamUpdate,
        signal: controller.signal,
      })
        .then((receivedTerminalUpdate) => {
          if (receivedTerminalUpdate || controller.signal.aborted) return;
          aiSummaryStreamFallbacksRef.current.add(resourceId);
          void refreshResource(resourceId).catch(() => {
            // The regular metadata refresh remains the fallback transport.
          });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          aiSummaryStreamFallbacksRef.current.add(resourceId);
          void refreshResource(resourceId).catch(() => {
            // The regular metadata refresh remains the fallback transport.
          });
        })
        .finally(() => {
          if (aiSummaryStreamsRef.current.get(resourceId) === controller) {
            aiSummaryStreamsRef.current.delete(resourceId);
          }
        });
    },
    [applyAiSummaryStreamUpdate, refreshResource],
  );

  useEffect(() => {
    if (!vaultId) return;
    const controller = new AbortController();
    const requestId = ++loadRequestRef.current;
    onVaultLoadingChange(vaultId, true);
    void loadDetail(controller.signal)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError(
            reason instanceof Error ? reason.message : "Could not load vault.",
          );
      })
      .finally(() => {
        if (loadRequestRef.current === requestId) {
          onVaultLoadingChange(vaultId, false);
        }
      });
    return () => {
      controller.abort();
      if (loadRequestRef.current === requestId) {
        loadRequestRef.current += 1;
        onVaultLoadingChange(vaultId, false);
      }
    };
  }, [loadDetail, onVaultLoadingChange, vaultId]);

  useEffect(() => {
    if (!detail) return;

    const activeIds = new Set(
      resources
        .filter((resource) => isActiveAiSummary(resource))
        .map((resource) => resource.id),
    );

    for (const resourceId of activeIds) {
      if (!aiSummaryStreamFallbacksRef.current.has(resourceId)) {
        startAiSummaryStream(resourceId);
      }
    }

    for (const [resourceId, controller] of aiSummaryStreamsRef.current) {
      if (!activeIds.has(resourceId)) {
        controller.abort();
        aiSummaryStreamsRef.current.delete(resourceId);
      }
    }

    for (const resourceId of aiSummaryStreamFallbacksRef.current) {
      if (!activeIds.has(resourceId)) {
        aiSummaryStreamFallbacksRef.current.delete(resourceId);
      }
    }
  }, [detail, resources, startAiSummaryStream]);

  useEffect(
    () => () => {
      for (const controller of aiSummaryStreamsRef.current.values()) {
        controller.abort();
      }
      aiSummaryStreamsRef.current.clear();
      aiSummaryStreamFallbacksRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!detail) return;

    const hasPendingMetadata = resources.some(
      (resource) =>
        resource.metadataStatus === "pending" ||
        resource.metadataStatus === "processing",
    );
    const hasAiSummaryFallback = resources.some((resource) =>
      aiSummaryStreamFallbacksRef.current.has(resource.id),
    );

    if (!hasPendingMetadata && !hasAiSummaryFallback) return;

    const pendingResourceIds = resources
      .filter(
        (resource) =>
          resource.metadataStatus === "pending" ||
          resource.metadataStatus === "processing" ||
          aiSummaryStreamFallbacksRef.current.has(resource.id),
      )
      .map((resource) => resource.id);
    const timer = window.setInterval(
      () => {
        void refreshResources(pendingResourceIds).catch(() => {
          // Keep the current card state visible if a background refresh fails.
        });
      },
      hasAiSummaryFallback
        ? AI_SUMMARY_POLL_INTERVAL_MS
        : METADATA_POLL_INTERVAL_MS,
    );

    return () => window.clearInterval(timer);
  }, [detail, refreshResources, resources]);

  function openEditVault() {
    if (!detail) return;
    setVaultForm({
      cover: detail.vault.cover,
      description: detail.vault.description,
      name: detail.vault.title,
      visibility: detail.vault.visibility,
    });
    setEditOpen(true);
  }

  async function openVaultSettings(tab: SettingsTab) {
    if (!vaultId || !detail) return;
    setSettingsTab(tab);
    setSettingsOpen(true);
    try {
      setSettingsLoading(true);
      if (tab === "share") setShare(await getVaultShare(vaultId));
      if (tab === "members")
        setCollaborators(await listVaultCollaborators(vaultId));
      if (tab === "submissions")
        setSubmissions(await listVaultSubmissions(vaultId));
    } catch (reason) {
      toast.add({
        type: "error",
        title:
          reason instanceof Error
            ? reason.message
            : "Could not load vault settings.",
      });
    } finally {
      setSettingsLoading(false);
    }
  }

  async function hashSharePassword(value: string) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  async function handleSaveShare() {
    if (!vaultId) return;
    await runMutation(async () => {
      const passwordHash =
        share.visibility === "password"
          ? await hashSharePassword(sharePassword)
          : null;
      const result = await updateVaultShare(vaultId, {
        visibility: share.visibility,
        passwordHash,
      });
      setShare((current) => ({
        ...current,
        ...result,
        visibility: share.visibility,
      }));
    }, "Share settings saved");
  }

  async function handleVaultOptionChange(patch: {
    collectionEnabled?: boolean;
    nsfwEnabled?: boolean;
  }) {
    if (!vaultId) return;
    await runMutation(
      () => updateDashboardVaultOptions(vaultId, patch),
      "Vault settings updated",
    );
  }

  async function handleRemoveCollaborator(id: string) {
    if (!vaultId) return;
    if (
      await runMutation(
        () => removeVaultCollaborator(vaultId, id),
        "Collaborator removed",
      )
    ) {
      setCollaborators((items) => items.filter((item) => item.id !== id));
    }
  }

  async function handleApproveSubmission(id: string, spaceId?: string) {
    if (!vaultId) return;
    if (
      await runMutation(
        () => approveVaultSubmission(vaultId, id, spaceId),
        "Submission approved",
      )
    ) {
      setSubmissions((items) => items.filter((item) => item.id !== id));
    }
  }

  async function handleRejectSubmission(id: string) {
    if (!vaultId) return;
    if (
      await runMutation(
        () => rejectVaultSubmission(vaultId, id),
        "Submission rejected",
      )
    ) {
      setSubmissions((items) => items.filter((item) => item.id !== id));
    }
  }

  async function handleExportVault() {
    if (!vaultId) return;
    try {
      const data = await exportVault(vaultId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${detail?.vault.title || "vault"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.add({ type: "success", title: "Vault exported" });
    } catch (reason) {
      toast.add({
        type: "error",
        title:
          reason instanceof Error ? reason.message : "Could not export vault.",
      });
    }
  }

  async function handleImportVault(file: File) {
    try {
      setIsImporting(true);
      const parsed = JSON.parse(await file.text()) as VaultExport;
      const result = await importVault(parsed);
      toast.add({ type: "success", title: "Vault imported" });
      setSettingsOpen(false);
      navigate(`/dashboard/vault/${result.id}`);
    } catch (reason) {
      toast.add({
        type: "error",
        title:
          reason instanceof Error ? reason.message : "Could not import vault.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function runMutation(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    try {
      setBusy(true);
      await action();
      await loadDetail(undefined, { resetResources: false });
      toast.add({ title: successMessage, type: "success" });
      return true;
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error ? reason.message : "Vault update failed.",
        type: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleEditVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;
    const currentVaultId = vaultId;
    const form = vaultForm;
    setEditOpen(false);
    setBusy(true);
    void updateDashboardVault(currentVaultId, form)
      .then(() => {
        void loadDetail().catch(() => undefined);
        void refreshVaults().catch(() => undefined);
        toast.add({ title: "Vault updated", type: "success" });
      })
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error ? reason.message : "Vault update failed.",
          type: "error",
        });
      })
      .finally(() => setBusy(false));
  }

  function handleCreateSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;

    if (targetSpaceVaultId) {
      const destinationVaultId = targetSpaceVaultId;
      const form = spaceForm;
      setTargetSpaceVaultId(undefined);
      setSpaceOpen(false);
      setSpaceForm({ description: "", icon: "tv", name: "" });
      setBusy(true);
      void createVaultSpace(destinationVaultId, form)
        .then((created) => {
          void Promise.all([loadDetail(), loadTransferTargets()]).catch(
            () => undefined,
          );
          setTransferFocusSpaceId(created.id);
          toast.add({ title: "Space created", type: "success" });
        })
        .catch((reason: unknown) => {
          toast.add({
            title:
              reason instanceof Error
                ? reason.message
                : "Could not create space.",
            type: "error",
          });
        })
        .finally(() => setBusy(false));
      return;
    }

    const currentVaultId = vaultId;
    const form = spaceForm;
    setSpaceOpen(false);
    setSpaceForm({ description: "", icon: "tv", name: "" });
    setBusy(true);
    void createVaultSpace(currentVaultId, form)
      .then(() => {
        void loadDetail().catch(() => undefined);
        toast.add({ title: "Space created", type: "success" });
      })
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error
              ? reason.message
              : "Could not create space.",
          type: "error",
        });
      })
      .finally(() => setBusy(false));
  }

  function openEditSpace(space: {
    id: string;
    name: string;
    description: string;
    icon: string;
  }) {
    setSpaceToEdit(space);
    setSpaceForm({
      description: space.description,
      icon: space.icon,
      name: space.name,
    });
    setEditSpaceOpen(true);
  }

  function handleEditSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId || !spaceToEdit) return;
    const currentVaultId = vaultId;
    const currentSpaceId = spaceToEdit.id;
    const form = spaceForm;
    setEditSpaceOpen(false);
    setSpaceToEdit(null);
    setBusy(true);
    void updateVaultSpace(currentVaultId, currentSpaceId, form)
      .then(() => {
        void loadDetail().catch(() => undefined);
        toast.add({ title: "Space updated", type: "success" });
      })
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error ? reason.message : "Vault update failed.",
          type: "error",
        });
      })
      .finally(() => setBusy(false));
  }

  async function handleDeleteSpace(spaceId: string) {
    if (!vaultId) return;
    await runMutation(
      () => deleteVaultSpace(vaultId, spaceId),
      "Space deleted",
    );
  }

  function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;
    const currentVaultId = vaultId;
    const form = resourceForm;
    setResourceOpen(false);
    setResourceForm({
      description: "",
      extractionCode: "",
      referer: "",
      spaceId: "",
      title: "",
      url: "",
    });
    setBusy(true);
    void createVaultResource(currentVaultId, form)
      .then(async ({ id }) => {
        await Promise.all([
          refreshResource(id, { addIfMissing: true }),
          loadDetail(undefined, { resetResources: false }),
        ]);
        toast.add({ title: "Resource added", type: "success" });
      })
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error
              ? reason.message
              : "Could not add resource.",
          type: "error",
        });
      })
      .finally(() => setBusy(false));
  }

  async function handleCreateMediaResource(
    files: File[],
    onProgress: (progress: LocalMediaUploadProgress) => void,
  ) {
    if (!vaultId) return;
    setBusy(true);
    try {
      const created = await runMediaUpload(files, (reportProgress) => {
        return uploadLocalMediaResource(
          vaultId,
          {
            description: resourceForm.description,
            files,
            referer: resourceForm.referer,
            spaceId: resourceForm.spaceId || detail?.spaces[0]?.id,
            title: resourceForm.title,
          },
          (progress) => {
            onProgress(progress);
            reportProgress(progress);
          },
        );
      });
      if (created && typeof created === "object" && "id" in created) {
        await Promise.all([
          refreshResource(String(created.id), { addIfMissing: true }),
          loadDetail(undefined, { resetResources: false }),
        ]);
      }
      setResourceForm({
        description: "",
        extractionCode: "",
        referer: "",
        spaceId: "",
        title: "",
        url: "",
      });
      toast.add({ title: "Resource added", type: "success" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVault() {
    if (!vaultId) return;
    try {
      setBusy(true);
      await deleteDashboardVault(vaultId);
      toast.add({ title: "Vault deleted", type: "success" });
      navigate("/dashboard");
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error ? reason.message : "Could not delete vault.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateResourceAnnotation(
    resourceId: string,
    patch: Parameters<typeof updateResourceAnnotation>[1],
  ) {
    const completed = await runMutation(
      () => updateResourceAnnotation(resourceId, patch),
      "Annotation updated",
    );
    if (completed) await refreshResource(resourceId);
  }

  async function handleDeleteResource(resourceId: string) {
    const deleted = await runMutation(() => deleteResource(resourceId), "Resource deleted");
    if (deleted) {
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
      setSelectedResourceIds((current) => {
        const next = new Set(current);
        next.delete(resourceId);
        return next;
      });
    }
  }

  async function handleResolveResourceMetadata(resourceId: string) {
    const completed = await runMutation(
      () => resolveResourceMetadata(resourceId),
      "Metadata retrieval started",
    );
    if (completed) await refreshResource(resourceId);
  }

  async function handleToggleResourceStar(resource: Resource) {
    const completed = await runMutation(
      () => setResourceStarred(resource.id, !resource.isStarred),
      resource.isStarred ? "Resource removed from starred" : "Resource starred",
    );
    if (completed) await refreshResource(resource.id);
  }

  async function handleToggleResourceReadLater(resource: Resource) {
    const completed = await runMutation(
      () => setResourceReadLater(resource.id, !resource.isReadLater),
      resource.isReadLater
        ? "Removed from watch later"
        : "Saved to watch later",
    );
    if (completed) await refreshResource(resource.id);
  }

  async function loadTransferTargets() {
    setTransferTargets(await listResourceTransferTargets());
  }

  function openCreateTransferTargetSpace(targetVaultId: string) {
    setTargetSpaceVaultId(targetVaultId);
    setSpaceForm({ description: "", icon: "tv", name: "" });
    setSpaceOpen(true);
  }

  async function handleTransferResource(input: {
    action: "move" | "copy";
    resourceId: string;
    targetVaultId: string;
    targetSpaceId: string;
  }) {
    const completed = await runMutation(
      () => transferResource(input.resourceId, input),
      input.action === "move" ? "Resource moved" : "Resource copied",
    );
    if (completed && input.action === "move") {
      setResources((current) =>
        current.filter((resource) => resource.id !== input.resourceId),
      );
    }
  }

  async function handleBatchTransferResources(input: {
    action: "move" | "copy";
    targetVaultId: string;
    targetSpaceId: string;
  }) {
    const resourceIds = [...selectedResourceIds];
    if (!resourceIds.length) return;

    const completed = await runMutation(
      () => transferResources({ ...input, resourceIds }),
      input.action === "move"
        ? `${resourceIds.length} resources moved`
        : `${resourceIds.length} resources copied`,
    );
    if (completed) {
      if (input.action === "move") {
        const movedIds = new Set(resourceIds);
        setResources((current) =>
          current.filter((resource) => !movedIds.has(resource.id)),
        );
      }
      setSelectedResourceIds(new Set());
      setSelectionSpaceId(null);
    }
  }

  async function handleTransferSpace(spaceId: string, targetVaultId: string) {
    if (!vaultId) return;
    const moved = await runMutation(
      () => transferVaultSpace(vaultId, spaceId, targetVaultId),
      "Space moved",
    );
    if (moved) await loadTransferTargets();
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!detail || !vaultId || event.canceled) return;

    const { source } = event.operation;
    if (!source || !isSortable(source)) return;

    // OptimisticSortingPlugin updates these values while dragging. The
    // operation target intentionally points back to the source, so IDs are
    // not used to calculate the final order.
    const { initialIndex, index: finalIndex, initialGroup, group } = source;
    if (initialIndex === finalIndex && initialGroup === group) return;

    const sourceId = String(source.id);
    if (sourceId.startsWith("space:")) {
      if (initialGroup !== "spaces" || group !== "spaces") return;
      const movedSpaces = moveItem(detail.spaces, initialIndex, finalIndex);
      if (!movedSpaces) return;
      const nextSpaces = movedSpaces.map((space, position) => ({
        ...space,
        position,
      }));

      // Ignore any detail request that started before this optimistic reorder.
      detailRevisionRef.current += 1;
      setDetail((current) =>
        current ? { ...current, spaces: nextSpaces } : current,
      );
      setBusy(true);
      void reorderVaultSpaces(
        vaultId,
        nextSpaces.map((space, position) => ({ id: space.id, position })),
      )
        .then(() => toast.add({ title: "Spaces reordered", type: "success" }))
        .catch((reason: unknown) => {
          toast.add({
            title:
              reason instanceof Error
                ? reason.message
                : "Could not reorder spaces.",
            type: "error",
          });
          void loadDetail();
        })
        .finally(() => setBusy(false));
      return;
    }

    if (!sourceId.startsWith("resource:") || initialGroup !== group) return;
    const sourceResourceId = sourceId.slice("resource:".length);
    const sourceSpaceId = resources.find(
      (resource) => resource.id === sourceResourceId,
    )?.spaceId;
    if (!sourceSpaceId) return;
    const totalInSourceSpace =
      detail.spaces.find((space) => space.id === sourceSpaceId)
        ?.resourceCount ?? 0;
    const loadedInSourceSpace = resources.filter(
      (resource) => resource.spaceId === sourceSpaceId,
    ).length;
    if (loadedInSourceSpace < totalInSourceSpace) {
      toast.add({
        title: "Load the rest of this space before reordering resources.",
        type: "info",
      });
      return;
    }

    const spaceResources = resources
      .filter((resource) => resource.spaceId === sourceSpaceId)
      .sort((left, right) => left.position - right.position);
    const reordered = moveItem(spaceResources, initialIndex, finalIndex);
    if (!reordered) return;

    const updatedReordered = reordered.map((resource, position) => ({
      ...resource,
      position,
    }));
    const firstResourceIndex = resources.findIndex(
      (resource) => resource.spaceId === sourceSpaceId,
    );
    const nextResources = resources.filter(
      (resource) => resource.spaceId !== sourceSpaceId,
    );
    nextResources.splice(
      Math.max(0, firstResourceIndex),
      0,
      ...updatedReordered,
    );
    // Ignore any detail request that started before this optimistic reorder.
    detailRevisionRef.current += 1;
    setResources(nextResources);
    setBusy(true);
    void reorderVaultResources(
      vaultId,
      reordered.map((resource, position) => ({
        id: resource.id,
        spaceId: sourceSpaceId,
        position,
      })),
    )
      .then(() => toast.add({ title: "Resources reordered", type: "success" }))
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error
              ? reason.message
              : "Could not reorder resources.",
          type: "error",
        });
        void loadDetail();
      })
      .finally(() => setBusy(false));
  }

  function toggleSpaceSelectionMode(spaceId: string) {
    setSelectionSpaceId((current) => (current === spaceId ? null : spaceId));
    setSelectedResourceIds(new Set());
  }

  function toggleResourceSelected(resourceId: string, selected: boolean) {
    setSelectedResourceIds((current) => {
      const next = new Set(current);
      if (selected) next.add(resourceId);
      else next.delete(resourceId);
      return next;
    });
  }

  const openResourceEditor = useCallback((resource: Resource) => {
    setResourceToEdit(resource);
    setResourceEditOpen(true);
  }, []);

  const scrollToResource = useCallback((resourceId: string) => {
    document
      .getElementById(`resource-${resourceId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const resourceId = location.hash.replace(/^#resource-/, "");
    if (!detail || !resourceId || resourceId === location.hash) return;
    const frame = window.requestAnimationFrame(() =>
      scrollToResource(resourceId),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [detail, location.hash, scrollToResource]);

  useEffect(() => {
    if (!detail || !vaultId) return;
    const canCreateResource =
      detail.actorRole === "owner" || detail.actorRole === "editor";

    onVaultStatusChange({
      vaultId,
      resourceCount: detail.spaces.reduce(
        (total, space) => total + space.resourceCount,
        0,
      ),
      onCreateResource: canCreateResource
        ? () => setResourceOpen(true)
        : undefined,
      resources: resources.map((resource) => ({
        id: resource.id,
        spaceName:
          detail.spaces.find((space) => space.id === resource.spaceId)?.name ??
          "Unsorted",
        title: resource.title,
        url: resource.url,
        onSelect: () => scrollToResource(resource.id),
      })),
    });

    return () => onVaultStatusChange(null);
  }, [detail, onVaultStatusChange, resources, scrollToResource, vaultId]);

  async function handleSaveResourceDetails(
    form: ResourceDetailsForm,
    mediaChange?: ResourceDetailsMediaChange,
  ) {
    if (!resourceToEdit) return;
    const resource = resourceToEdit;
    setResourceEditOpen(false);
    setResourceToEdit(undefined);
    setBusy(true);
    void (
      resource.type === "local_media" && mediaChange
        ? runMediaUpload(mediaChange.files, (reportProgress) =>
            updateLocalMediaResource(
              resource.id,
              {
                ...form,
                files: mediaChange.files,
                order: mediaChange.order,
              },
              reportProgress,
            ),
          )
        : updateResourceDetails(resource.id, form)
    )
      .then(() => refreshResource(resource.id))
      .then(() => toast.add({ title: "Resource updated", type: "success" }))
      .catch((reason: unknown) => {
        toast.add({
          title:
            reason instanceof Error
              ? reason.message
              : "Resource update failed.",
          type: "error",
        });
      })
      .finally(() => setBusy(false));
  }

  async function runMediaUpload<T>(
    files: File[],
    upload: (
      onProgress: (progress: LocalMediaUploadProgress) => void,
    ) => Promise<T>,
  ) {
    if (files.length === 0) return upload(() => undefined);

    const toastId = `local-media-upload-${crypto.randomUUID()}`;
    uploadInProgressRef.current = true;
    toast.add({
      id: toastId,
      title: "Uploading media",
      type: "loading",
      timeout: 0,
      description: (
        <MediaUploadToastDescription
          files={files}
          progress={{
            completedBytes: 0,
            fileIndex: -1,
            fileProgress: 0,
            phase: "preparing",
            speedBytesPerSecond: 0,
            totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          }}
        />
      ),
    });

    try {
      const result = await upload((progress) => {
        toast.update(toastId, {
          description: (
            <MediaUploadToastDescription files={files} progress={progress} />
          ),
        });
      });
      toast.update(toastId, {
        title: "Media upload complete",
        type: "success",
        timeout: 4000,
        description: `${files.length} ${files.length === 1 ? "file" : "files"} uploaded.`,
      });
      return result;
    } catch (reason) {
      toast.update(toastId, {
        title: "Media upload failed",
        type: "error",
        timeout: 8000,
        description:
          reason instanceof Error ? reason.message : "Media upload failed.",
      });
      throw reason;
    } finally {
      uploadInProgressRef.current = false;
    }
  }

  function MediaUploadToastDescription({
    files,
    progress,
  }: {
    files: File[];
    progress: LocalMediaUploadProgress;
  }) {
    const imagePreviews = useMemo(
      () =>
        files
          .filter((file) => file instanceof Blob && isUploadImageFile(file))
          .map((file) => ({ file, url: URL.createObjectURL(file) })),
      [files],
    );
    useEffect(
      () => () => imagePreviews.forEach(({ url }) => URL.revokeObjectURL(url)),
      [imagePreviews],
    );

    const percent =
      progress.totalBytes > 0
        ? Math.round((progress.completedBytes / progress.totalBytes) * 100)
        : 0;
    const currentFile =
      progress.fileIndex >= 0 ? files[progress.fileIndex]?.name : undefined;

    return (
      <div className="min-w-0 space-y-2">
        {imagePreviews.length > 0 ? (
          <div className="flex gap-1.5 overflow-hidden">
            {imagePreviews.slice(0, 6).map(({ file, url }) => (
              <img
                alt={file.name}
                className="size-10 shrink-0 object-cover"
                decoding="async"
                key={url}
                src={url}
              />
            ))}
          </div>
        ) : null}
        <p className="truncate text-xs" title={currentFile}>
          {progress.phase === "preparing"
            ? "Preparing upload..."
            : progress.phase === "finalizing"
              ? "Finalizing upload..."
              : currentFile
                ? `Uploading ${currentFile}`
                : "Uploading media..."}
        </p>
        <ProgressBar label="Upload progress" value={percent} />
        <p className="text-xs text-muted-foreground">
          {progress.phase === "uploading"
            ? `${formatUploadSpeed(progress.speedBytesPerSecond)} · ${formatUploadSize(progress.completedBytes)} / ${formatUploadSize(progress.totalBytes)}`
            : progress.phase === "finalizing"
              ? "Completing uploaded files..."
              : "Preparing files and upload session..."}
        </p>
        <p className="text-xs text-muted-foreground">
          {progress.fileIndex >= 0
            ? `${Math.min(progress.fileIndex + 1, files.length)} / ${files.length} files`
            : `${files.length} ${files.length === 1 ? "file" : "files"}`}
        </p>
      </div>
    );
  }

  function isUploadImageFile(file: File) {
    if (
      typeof file.type === "string" &&
      file.type.toLowerCase().startsWith("image/")
    )
      return true;
    return /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(file.name);
  }
  function formatUploadSpeed(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "-- MB/s";
    return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  function formatUploadSize(value: number) {
    if (!Number.isFinite(value) || value < 1024 * 1024) {
      return `${Math.max(0, Math.round(value / 1024))} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!vaultId) return <VaultDetailError message="Vault id is missing." />;
  if (error) return <VaultDetailError message={error} />;
  if (!detail)
    return (
      <section className="grid min-h-[18rem] place-items-center">
        <div className="flex items-center gap-2 font-mono text-label text-muted-foreground">
          <Spinner variant="accent" size="sm" label="Loading vault" />
          Loading vault...
        </div>
      </section>
    );
  return (
    <section className="vault-detail-page">
      <div className="w-full shrink-0 mt-4">
        <div className="mx-auto w-full ">
          <VaultHeader
            detail={detail}
            disabled={busy}
            onAddResource={() => setResourceOpen(true)}
            onCreateSpace={() => setSpaceOpen(true)}
            onDeleteVault={() => setDeleteOpen(true)}
            onEditVault={openEditVault}
            onOpenSettings={(tab) => {
              void openVaultSettings(tab);
            }}
          />
        </div>
      </div>
      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="vault-detail-page__body">
          <main
            aria-label="Vault content"
            className="vault-detail-page__content"
          >
            {detail.spaces.map((space, index) => (
              <SpaceSection
                key={space.id}
                canAddResource={
                  detail.actorRole === "owner" || detail.actorRole === "editor"
                }
                collapsed={collapsedSpaceIds.has(space.id)}
                disabled={busy}
                isVaultOwner={detail.actorRole === "owner"}
                index={index}
                onLoadTransferTargets={loadTransferTargets}
                onTransferSpace={handleTransferSpace}
                onAddResource={() => {
                  setResourceForm((form) => ({ ...form, spaceId: space.id }));
                  setResourceOpen(true);
                }}
                onDeleteSpace={() => void handleDeleteSpace(space.id)}
                onEditSpace={() => openEditSpace(space)}
                onToggleCollapsed={() =>
                  setCollapsedSpaceIds((current) => {
                    const next = new Set(current);
                    if (next.has(space.id)) {
                      next.delete(space.id);
                    } else next.add(space.id);
                    return next;
                  })
                }
                onUpdateIcon={(icon) => {
                  if (!vaultId) return;
                  return runMutation(
                    () =>
                      updateVaultSpace(vaultId, space.id, {
                        description: space.description ?? "",
                        icon,
                        name: space.name,
                      }),
                    "Space icon updated",
                  ).then(() => undefined);
                }}
                resources={resources.filter(
                  (resource) => resource.spaceId === space.id,
                )}
                hasMoreResources={
                  space.resourceCount > 0 &&
                  !resourcePages[space.id]?.complete
                }
                onLoadMoreResources={() => loadResourceSpacePage(space.id)}
                resourceCount={space.resourceCount}
                resourcesLoaded={
                  space.resourceCount === 0 ||
                  resourcePages[space.id]?.loaded === true
                }
                resourcesLoading={resourcePages[space.id]?.loading ?? false}
                space={space}
                sourceVaultId={detail.vault.id}
                transferTargets={transferTargets}
                selectedResourceIds={
                  selectionSpaceId === space.id
                    ? selectedResourceIds
                    : new Set()
                }
                selectionMode={selectionSpaceId === space.id}
                onToggleResourceSelected={toggleResourceSelected}
                onToggleSelectionMode={() => toggleSpaceSelectionMode(space.id)}
                viewMode={viewMode}
                renderResource={(resource, index, selection) => (
                  <ResourceCard
                    canDeleteResource={detail.actorRole === "owner"}
                    canEditResource={
                      detail.actorRole === "owner" ||
                      detail.actorRole === "editor"
                    }
                    disabled={busy}
                    index={index}
                    isActive={false}
                    isSignedIn
                    isVaultOwner={detail.actorRole === "owner"}
                    mediaVisible={mediaVisible}
                    onCreateTransferTargetSpace={openCreateTransferTargetSpace}
                    onDelete={() => void handleDeleteResource(resource.id)}
                    onLoadTransferTargets={loadTransferTargets}
                    onOpenDetails={() => openResourceEditor(resource)}
                    onResolveMetadata={() =>
                      void handleResolveResourceMetadata(resource.id)
                    }
                    onToggleReadLater={() =>
                      void handleToggleResourceReadLater(resource)
                    }
                    onToggleStar={() => void handleToggleResourceStar(resource)}
                    onToggleSelected={selection?.onToggleSelected}
                    showSelectionControl={Boolean(selection)}
                    isSelected={selection?.isSelected ?? false}
                    onUpdateAnnotation={(resourceId, patch) => {
                      void handleUpdateResourceAnnotation(resourceId, patch);
                    }}
                    onTransferResource={handleTransferResource}
                    resource={resource}
                    spaceId={space.id}
                    transferFocusSpaceId={transferFocusSpaceId}
                    transferTargets={transferTargets}
                    vaultId={detail.vault.id}
                    vaultName={detail.vault.title}
                    spaceName={space.name}
                    viewMode={viewMode}
                  />
                )}
              />
            ))}
            {detail.spaces.length === 0 ? (
              <div className="grid min-h-40 place-items-center border border-dashed border-border text-ui text-muted-foreground">
                No spaces yet
              </div>
            ) : null}
          </main>
          <VaultOutline
            allSpacesCollapsed={allSpacesCollapsed}
            disabled={busy}
            detail={detail}
            onBatchTransfer={handleBatchTransferResources}
            onAddSpace={() => setSpaceOpen(true)}
            onCreateTransferTargetSpace={openCreateTransferTargetSpace}
            onLoadTransferTargets={loadTransferTargets}
            onSelectSpace={(spaceId) => {
              setCollapsedSpaceIds((current) => {
                if (!current.has(spaceId)) return current;
                const next = new Set(current);
                next.delete(spaceId);
                return next;
              });
            }}
            onToggleAllSpaces={() => {
              setCollapsedSpaceIds(
                allSpacesCollapsed
                  ? new Set()
                  : new Set(detail.spaces.map((space) => space.id)),
              );
            }}
            onViewModeChange={handleViewModeChange}
            selectedResourceIds={selectedResourceIds}
            selectionSpaceId={selectionSpaceId}
            transferTargets={transferTargets}
            viewMode={viewMode}
          />
        </div>
      </DragDropProvider>
      {/* <VaultResourcePreviewRail resources={detail.resources} /> */}
      <CreateVaultDialog
        form={vaultForm}
        isSubmitting={busy}
        mode="edit"
        onFormChange={setVaultForm}
        onOpenChange={setEditOpen}
        onSubmit={handleEditVault}
        open={editOpen}
      />
      <CreateSpaceDialog
        contextLabel={
          targetSpaceVaultId
            ? (transferTargets.find(
                (target) => target.id === targetSpaceVaultId,
              )?.title ?? detail.vault.title)
            : detail.vault.title
        }
        form={spaceForm}
        onFormChange={setSpaceForm}
        onOpenChange={(open) => {
          setSpaceOpen(open);
          if (!open) setTargetSpaceVaultId(undefined);
        }}
        onSubmit={handleCreateSpace}
        open={spaceOpen}
      />
      <CreateSpaceDialog
        contextLabel={detail.vault.title}
        form={spaceForm}
        mode="edit"
        onFormChange={setSpaceForm}
        onOpenChange={setEditSpaceOpen}
        onSubmit={handleEditSpace}
        open={editSpaceOpen}
      />
      <CreateResourceDialog
        allowMediaUpload={detail.allowResourceMediaUpload}
        form={resourceForm}
        isSubmitting={busy}
        onFormChange={setResourceForm}
        onMediaSubmit={handleCreateMediaResource}
        onOpenChange={setResourceOpen}
        onSubmit={handleCreateResource}
        open={resourceOpen}
        spaces={detail.spaces}
      />
      <ResourceSubmissionReviewDialog
        open={submissionOpen}
        onChanged={() => void loadDetail()}
        onOpenChange={setSubmissionOpen}
        spaces={detail.spaces}
        vaultId={detail.vault.id}
      />
      <VaultSettingsSheet
        activeTab={settingsTab}
        canDeleteVault={detail.actorRole === "owner"}
        collaborators={collaborators}
        collectionEnabled={detail.vault.collectionEnabled}
        isBusy={busy || settingsLoading}
        isImporting={isImporting}
        nsfwEnabled={detail.vault.nsfwEnabled}
        onApproveSubmission={(id, spaceId) =>
          void handleApproveSubmission(id, spaceId)
        }
        onCollectionChange={(value) =>
          void handleVaultOptionChange({ collectionEnabled: value })
        }
        onDelete={() => void handleDeleteVault()}
        onExport={() => void handleExportVault()}
        onImport={(file) => void handleImportVault(file)}
        onNsfwChange={(value) =>
          void handleVaultOptionChange({ nsfwEnabled: value })
        }
        onOpenChange={setSettingsOpen}
        onPasswordChange={setSharePassword}
        onRejectSubmission={(id) => void handleRejectSubmission(id)}
        onRemoveCollaborator={(id) => void handleRemoveCollaborator(id)}
        onSubmitShare={() => void handleSaveShare()}
        onTabChange={(tab) => void openVaultSettings(tab)}
        onVisibilityChange={(value) =>
          setShare((current) => ({ ...current, visibility: value }))
        }
        open={settingsOpen}
        ownerName={detail.vault.ownerName ?? ""}
        password={sharePassword}
        share={share}
        spaces={detail.spaces}
        submissions={submissions}
      />
      <ResourceDetailsSheet
        busy={busy}
        canEdit={detail.actorRole === "owner" || detail.actorRole === "editor"}
        onOpenChange={(open) => {
          setResourceEditOpen(open);
          if (!open) setResourceToEdit(undefined);
        }}
        onSave={(form, media) => void handleSaveResourceDetails(form, media)}
        open={resourceEditOpen}
        resource={resourceToEdit}
        spaces={detail.spaces}
      />
      <DeleteVaultDialog
        busy={busy}
        onConfirm={() => void handleDeleteVault()}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        vaultTitle={detail.vault.title}
      />
    </section>
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return null;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return null;
  next.splice(toIndex, 0, moved);
  return next;
}

function isActiveAiSummary(resource: Resource) {
  const value = resource.metadata?.data?.extra?.aiSummary;
  if (!value || typeof value !== "object") return false;
  const status = (value as Record<string, unknown>).status;
  return status === "pending" || status === "processing";
}

function VaultDetailError({ message }: { message: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Vault unavailable</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </section>
  );
}

function DeleteVaultDialog({
  busy,
  onConfirm,
  onOpenChange,
  open,
  vaultTitle,
}: {
  busy: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  vaultTitle: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div>
            <DialogTitle>Delete vault?</DialogTitle>
            <DialogDescription>
              This permanently removes {vaultTitle} and its spaces, resources,
              sharing, and collaborator access.
            </DialogDescription>
          </div>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>
        <DialogBody>
          <p className="font-mono text-label text-destructive">
            This action cannot be undone.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {busy ? "Deleting..." : "Delete vault"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
