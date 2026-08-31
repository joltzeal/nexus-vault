/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
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
import {
  CreateResourceDialog,
  ResourceSubmissionReviewDialog,
} from "@/features/resource/components";
import {
  ResourceCard,
  ResourceDetailsSheet,
  type ResourceDetailsForm,
} from "@/features/resource/components";
import {
  deleteResource,
  listResourceTransferTargets,
  reorderVaultResources,
  resolveResourceMetadata,
  setResourceReadLater,
  setResourceStarred,
  transferResource,
  transferResources,
  updateResourceAnnotation,
  updateResourceDetails,
  uploadLocalMediaResource,
} from "@/features/resource/api";
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
import type { VaultViewMode } from "@/features/vault/components/vault-outline";
import "@/features/vault/styles/vault-detail-layout.css";

const Button: any = ButtonPrimitive;

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>();
  const navigate = useNavigate();
  const { mediaVisible, onVaultStatusChange, refreshVaults } =
    useOutletContext<DashboardOutletContext>();
  const [detail, setDetail] = useState<VaultDetail | null>(null);
  const detailRevisionRef = useRef(0);
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
  const [viewMode, setViewMode] = useState<VaultViewMode>("list");
  const [selectionSpaceId, setSelectionSpaceId] = useState<string | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(
    new Set(),
  );
  const [transferTargets, setTransferTargets] = useState<
    ResourceTransferTargetVault[]
  >([]);
  const [transferFocusSpaceId, setTransferFocusSpaceId] = useState<string>();
  const [targetSpaceVaultId, setTargetSpaceVaultId] = useState<string>();

  useDocumentTitle(
    detail?.vault.title
      ? `${detail.vault.title} · Nexus Vault`
      : "Vault · Nexus Vault",
  );

  const loadDetail = useCallback(
    (signal?: AbortSignal) => {
      if (!vaultId) return Promise.resolve();
      const revision = detailRevisionRef.current;
      return getDashboardVaultDetail(vaultId, signal).then((nextDetail) => {
        if (revision !== detailRevisionRef.current) return;
        setDetail(nextDetail);
        setError("");
      });
    },
    [vaultId],
  );

  useEffect(() => {
    if (!vaultId) return;
    const controller = new AbortController();
    void loadDetail(controller.signal).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError"))
        setError(
          reason instanceof Error ? reason.message : "Could not load vault.",
        );
    });
    return () => controller.abort();
  }, [loadDetail, vaultId]);

  useEffect(() => {
    if (
      !detail ||
      !detail.resources.some(
        (resource) =>
          resource.metadataStatus === "pending" ||
          resource.metadataStatus === "processing",
      )
    )
      return;

    const timer = window.setInterval(() => {
      void loadDetail().catch(() => {
        // Keep the current card state visible if a background refresh fails.
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [detail, loadDetail]);

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
      await loadDetail();
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

  async function handleEditVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;
    if (
      await runMutation(
        () => updateDashboardVault(vaultId, vaultForm),
        "Vault updated",
      )
    ) {
      setEditOpen(false);
      void refreshVaults().catch(() => {
        // The detail has already refreshed; retry the sidebar list on next navigation.
      });
    }
  }

  async function handleCreateSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;

    if (targetSpaceVaultId) {
      try {
        setBusy(true);
        const created = await createVaultSpace(targetSpaceVaultId, spaceForm);
        await Promise.all([loadDetail(), loadTransferTargets()]);
        setTransferFocusSpaceId(created.id);
        setTargetSpaceVaultId(undefined);
        setSpaceOpen(false);
        setSpaceForm({ description: "", icon: "tv", name: "" });
        toast.add({ title: "Space created", type: "success" });
      } catch (reason) {
        toast.add({
          title:
            reason instanceof Error
              ? reason.message
              : "Could not create space.",
          type: "error",
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (
      await runMutation(
        () => createVaultSpace(vaultId, spaceForm),
        "Space created",
      )
    ) {
      setSpaceOpen(false);
      setSpaceForm({ description: "", icon: "tv", name: "" });
    }
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

  async function handleEditSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId || !spaceToEdit) return;
    if (
      await runMutation(
        () => updateVaultSpace(vaultId, spaceToEdit.id, spaceForm),
        "Space updated",
      )
    ) {
      setEditSpaceOpen(false);
      setSpaceToEdit(null);
    }
  }

  async function handleDeleteSpace(spaceId: string) {
    if (!vaultId) return;
    await runMutation(
      () => deleteVaultSpace(vaultId, spaceId),
      "Space deleted",
    );
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vaultId) return;
    if (
      await runMutation(
        () => createVaultResource(vaultId, resourceForm),
        "Resource added",
      )
    ) {
      setResourceOpen(false);
      setResourceForm({
        description: "",
        extractionCode: "",
        referer: "",
        spaceId: "",
        title: "",
        url: "",
      });
      void refreshVaults().catch(() => {
        // The current Vault refreshed successfully; the aggregate count retries later.
      });
    }
  }

  async function handleCreateMediaResource(
    files: File[],
    onProgress: (progress: LocalMediaUploadProgress) => void,
  ) {
    if (!vaultId) return;
    setBusy(true);
    try {
      await uploadLocalMediaResource(
        vaultId,
        {
          description: resourceForm.description,
          files,
          referer: resourceForm.referer,
          spaceId: resourceForm.spaceId || detail?.spaces[0]?.id,
          title: resourceForm.title,
        },
        onProgress,
      );
      await loadDetail();
      void refreshVaults().catch(() => {
        // The current Vault refreshed successfully; the aggregate count retries later.
      });
      setResourceForm({
        description: "",
        extractionCode: "",
        referer: "",
        spaceId: "",
        title: "",
        url: "",
      });
      toast.add({ title: "Resource added", type: "success" });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error ? reason.message : "Media upload failed.",
        type: "error",
      });
      throw reason;
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
    await runMutation(
      () => updateResourceAnnotation(resourceId, patch),
      "Annotation updated",
    );
  }

  async function handleDeleteResource(resourceId: string) {
    await runMutation(() => deleteResource(resourceId), "Resource deleted");
  }

  async function handleResolveResourceMetadata(resourceId: string) {
    await runMutation(
      () => resolveResourceMetadata(resourceId),
      "Metadata retrieval started",
    );
  }

  async function handleToggleResourceStar(resource: Resource) {
    await runMutation(
      () => setResourceStarred(resource.id, !resource.isStarred),
      resource.isStarred ? "Resource removed from starred" : "Resource starred",
    );
  }

  async function handleToggleResourceReadLater(resource: Resource) {
    await runMutation(
      () => setResourceReadLater(resource.id, !resource.isReadLater),
      resource.isReadLater
        ? "Removed from watch later"
        : "Saved to watch later",
    );
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
    await runMutation(
      () => transferResource(input.resourceId, input),
      input.action === "move" ? "Resource moved" : "Resource copied",
    );
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
    const sourceSpaceId = detail.resources.find(
      (resource) => resource.id === sourceResourceId,
    )?.spaceId;
    if (!sourceSpaceId) return;

    const spaceResources = detail.resources
      .filter((resource) => resource.spaceId === sourceSpaceId)
      .sort((left, right) => left.position - right.position);
    const reordered = moveItem(spaceResources, initialIndex, finalIndex);
    if (!reordered) return;

    const updatedReordered = reordered.map((resource, position) => ({
      ...resource,
      position,
    }));
    const firstResourceIndex = detail.resources.findIndex(
      (resource) => resource.spaceId === sourceSpaceId,
    );
    const nextResources = detail.resources.filter(
      (resource) => resource.spaceId !== sourceSpaceId,
    );
    nextResources.splice(
      Math.max(0, firstResourceIndex),
      0,
      ...updatedReordered,
    );
    // Ignore any detail request that started before this optimistic reorder.
    detailRevisionRef.current += 1;
    setDetail((current) =>
      current ? { ...current, resources: nextResources } : current,
    );
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

  useEffect(() => {
    if (!detail || !vaultId) return;
    const canCreateResource =
      detail.actorRole === "owner" || detail.actorRole === "editor";

    onVaultStatusChange({
      vaultId,
      resourceCount: detail.resources.length,
      onCreateResource: canCreateResource
        ? () => setResourceOpen(true)
        : undefined,
      resources: detail.resources.map((resource) => ({
        id: resource.id,
        spaceName:
          detail.spaces.find((space) => space.id === resource.spaceId)?.name ??
          "Unsorted",
        title: resource.title,
        url: resource.url,
        onSelect: () => openResourceEditor(resource),
      })),
    });

    return () => onVaultStatusChange(null);
  }, [detail, onVaultStatusChange, openResourceEditor, vaultId]);

  async function handleSaveResourceDetails(form: ResourceDetailsForm) {
    if (!resourceToEdit) return;
    if (
      await runMutation(
        () => updateResourceDetails(resourceToEdit.id, form),
        "Resource updated",
      )
    ) {
      setResourceEditOpen(false);
      setResourceToEdit(undefined);
    }
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
                    if (next.has(space.id)) next.delete(space.id);
                    else next.add(space.id);
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
                resources={detail.resources.filter(
                  (resource) => resource.spaceId === space.id,
                )}
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
            onToggleAllSpaces={() => {
              setCollapsedSpaceIds(
                allSpacesCollapsed
                  ? new Set()
                  : new Set(detail.spaces.map((space) => space.id)),
              );
            }}
            onViewModeChange={setViewMode}
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
        onSave={(form) => void handleSaveResourceDetails(form)}
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
