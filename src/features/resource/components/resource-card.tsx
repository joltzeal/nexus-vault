"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import {
  Copy,
  ExternalLink,
  FolderInput,
  FolderTree,
  GripVertical,
  Link as LinkIcon,
  Plus,
  Search,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
  type SVGProps,
} from "react";
import { toast } from "@/lib/toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button as AndromedaButton } from "@/components/aicanvas/andromeda/components/Button";
import { Badge as AndromedaBadge } from "@/components/aicanvas/andromeda/components/Badge";
import { Checkbox as AndromedaCheckbox } from "@/components/aicanvas/andromeda/components/Checkbox";
import { Tag as AndromedaTag } from "@/components/aicanvas/andromeda/components/Tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { inputVariants } from "@/components/aicanvas/andromeda/components/Input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree";
import { Tooltip as AndromedaTooltip } from "@/components/aicanvas/andromeda/components/Tooltip";
import { ResourceMediaGallery } from "@/features/resource/resource-media-gallery";
import {
  IconEmule,
  IconGithub,
  IconLink,
  IconThunder,
  resourceTypeIconMap,
} from "@/components/icons/resource-type";
import {
  ResourceDescription,
  type ResourceAiSummary,
} from "@/features/resource/components/resource-description";
import { ResourceFileTree } from "@/features/resource/components/resource-file-tree";
import {
  ResourceCardActions,
  ResourceCardCommentButton,
  ResourceCardCommentEditor,
} from "@/features/resource/components/cards/resource-card-actions";
import { ResourceCardFrame } from "@/features/resource/components/cards/resource-card-frame";
import { ResourcePreviewCard } from "@/features/resource/components/cards/resource-preview-card";
import { toResourceCardPreview } from "@/features/resource/components/cards/view-models";
import { SpaceIcon } from "@/features/resource/space-icon-picker";
import type { VaultResourceViewMode } from "@/features/resource/vault-view-mode";
import type {
  Resource,
  ResourceAnnotationPatch,
  ResourceTransferTargetVault,
} from "@/features/resource/types";
import { resourceTypes } from "@/features/resource/types";
import { cn } from "@/lib/utils";
import {
  getResourceFaviconUrl,
  getResourceDescription,
  getResourceDisplayUrl,
  getResourceMedia,
  getResourcePillItems,
  getResourceTitle,
  type ResourcePillItem,
} from "./cards/view-models";

type AndromedaProps = Record<string, unknown>;
const BaseButton = AndromedaButton as unknown as ComponentType<AndromedaProps>;
const BaseBadge = AndromedaBadge as unknown as ComponentType<AndromedaProps>;
const BaseTag = AndromedaTag as unknown as ComponentType<AndromedaProps>;
const BaseCheckbox =
  AndromedaCheckbox as unknown as ComponentType<AndromedaProps>;
const BaseTooltip =
  AndromedaTooltip as unknown as ComponentType<AndromedaProps>;
const transferActionClass = cn(
  inputVariants({ hasIcon: false, state: "default" }),
  "inline-flex h-6 w-auto items-center px-2 py-0 text-[10px] [transform:none!important] active:translate-y-0",
);
const transferCopyActionClass = cn(
  transferActionClass,
  "border-[color:var(--andromeda-accent-200)] bg-[color:var(--andromeda-accent-400)] text-[color:var(--andromeda-accent-on)] hover:border-[color:var(--andromeda-accent-200)] hover:bg-[color:var(--andromeda-accent-400)]",
);

export type ResourceDragData = {
  kind: "resource";
  resourceId: string;
  sourceSpaceId: string;
};

export function ResourceCard({
  className,
  disabled,
  index,
  canDeleteResource = false,
  canEditResource,
  isActive,
  isSelected = false,
  isSignedIn,
  isVaultOwner,
  mediaVisible,
  onCreateTransferTargetSpace,
  onDelete,
  onLoadTransferTargets,
  onOpenDetails,
  onResolveMetadata,
  onToggleReadLater,
  onToggleSelected,
  onToggleStar,
  onTransferResource,
  onUpdateAnnotation,
  resource,
  showAnnotationActions = true,
  showReadLaterAction = true,
  showSelectionControl = false,
  showStarAction = true,
  spaceId,
  transferFocusSpaceId,
  transferTargets,
  viewMode = "list",
}: {
  className?: string;
  disabled: boolean;
  index: number;
  canDeleteResource?: boolean;
  canEditResource: boolean;
  isActive: boolean;
  isSelected?: boolean;
  isSignedIn: boolean;
  isVaultOwner: boolean;
  mediaVisible: boolean;
  onCreateTransferTargetSpace: (vaultId: string) => void;
  /** Legacy activation callback retained for list consumers; title controls details now. */
  onActivate?: () => void;
  onDelete: () => void;
  onLoadTransferTargets: () => Promise<void>;
  onOpenDetails: () => void;
  onResolveMetadata?: () => void;
  onToggleReadLater?: (resourceId: string) => void;
  onToggleSelected?: (selected: boolean) => void;
  onToggleStar: () => void;
  onTransferResource: (input: {
    action: "move" | "copy";
    resourceId: string;
    targetVaultId: string;
    targetSpaceId: string;
  }) => Promise<void>;
  onUpdateAnnotation?: (
    resourceId: string,
    patch: ResourceAnnotationPatch,
  ) => void;
  resource: Resource;
  showAnnotationActions?: boolean;
  showReadLaterAction?: boolean;
  showSelectionControl?: boolean;
  showStarAction?: boolean;
  spaceId: string;
  transferFocusSpaceId?: string;
  transferTargets: ResourceTransferTargetVault[];
  vaultId: string;
  vaultName?: string;
  spaceName?: string;
  viewMode?: VaultResourceViewMode;
}) {
  const { handleRef, ref } = useSortable<ResourceDragData>({
    id: `resource:${resource.id}`,
    index,
    group: spaceId,
    type: "resource",
    accept: "resource",
    data: {
      kind: "resource",
      resourceId: resource.id,
      sourceSpaceId: spaceId,
    },
    disabled: disabled || !isVaultOwner || showSelectionControl,
  });
  const [externalOpen, setExternalOpen] = useState(false);
  const [specialDeleteOpen, setSpecialDeleteOpen] = useState(false);
  const [metadataRetryOpen, setMetadataRetryOpen] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [magnetTreeOpen, setMagnetTreeOpen] = useState(false);
  const magnetTreeCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const title = getResourceTitle(resource);
  const description = getResourceDescription(resource);
  const aiSummary = getResourceAiSummary(
    resource.metadata?.data?.extra?.aiSummary,
  );
  const displayUrl = getResourceDisplayUrl(resource);
  const refererUrl = getHttpUrl(resource.referer);
  const resourceLinkUrl =
    resource.type === "local_media" ? (refererUrl ?? "") : displayUrl;
  const media = getResourceMedia(resource);
  const downloadableMedia = getDownloadableResourceMedia(resource);
  const magnetFileTree =
    resource.type === "magnet" ? (resource.metadata?.data?.tree ?? []) : [];
  const resourceTypeLabel = getResourceTypeLabel(resource.type);
  const pills = getResourcePillItems(resource).filter(
    (pill) =>
      !(
        pill.kind === "label" &&
        (pill.label === resource.type || pill.label === resourceTypeLabel)
      ),
  );
  const isResolvingMetadata =
    resource.metadataStatus === "pending" ||
    resource.metadataStatus === "processing";
  const specializedPreview = toResourceCardPreview(resource);
  const specializedPreviewState = isResolvingMetadata
    ? ("loading" as const)
    : resource.metadataStatus === "failed"
      ? ("failed" as const)
      : ("ready" as const);
  const isMasonryView = viewMode === "masonry";
  const iconComponent = getResourceIconComponent(resource);
  const metadataFavicon = iconComponent
    ? undefined
    : getResourceMetadataFavicon(resource);
  const iconSrc = metadataFavicon;
  const fallbackIconSrc = iconComponent
    ? undefined
    : getResourceFaviconUrl(resource);
  const iconLabel =
    resource.type === "http" ? "WEB" : resource.type === "ftp" ? "FTP" : "LINK";
  const annotation = resource.annotation ?? null;
  const annotationChecked = annotation?.checked === true;
  const [checked, setChecked] = useState(annotationChecked);
  const rating = annotation?.rating ?? 0;
  const isWatchedLater = resource.isReadLater === true;
  const [localCommentDraft, setLocalCommentDraft] = useState(
    annotation?.comment ?? "",
  );
  const copyDisplayUrl = async () => {
    await navigator.clipboard?.writeText(resourceLinkUrl);
    toast.success("Link copied");
  };

  useEffect(
    () => () => {
      if (magnetTreeCloseTimerRef.current)
        clearTimeout(magnetTreeCloseTimerRef.current);
    },
    [],
  );

  function openMagnetTreeOnHover() {
    if (magnetTreeCloseTimerRef.current)
      clearTimeout(magnetTreeCloseTimerRef.current);
    setMagnetTreeOpen(true);
  }

  function closeMagnetTreeOnHover() {
    if (magnetTreeCloseTimerRef.current)
      clearTimeout(magnetTreeCloseTimerRef.current);
    magnetTreeCloseTimerRef.current = setTimeout(
      () => setMagnetTreeOpen(false),
      120,
    );
  }
  const copyPillValue = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  async function handleDownloadAllMedia() {
    if (downloadingMedia) return;
    setDownloadingMedia(true);
    try {
      const results = await Promise.allSettled(
        downloadableMedia.map((item) => downloadResourceMedia(item)),
      );
      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failedCount > 0) {
        toast.error(
          failedCount === downloadableMedia.length
            ? "Media download failed"
            : `${failedCount} media files could not be downloaded`,
        );
      } else {
        toast.success(
          downloadableMedia.length === 1
            ? "Media download started"
            : `${downloadableMedia.length} media downloads started`,
        );
      }
    } finally {
      setDownloadingMedia(false);
    }
  }

  useEffect(() => {
    // Keep the editor draft aligned after an annotation update from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCommentDraft(annotation?.comment ?? "");
  }, [annotation?.comment]);

  useEffect(() => {
    // Reconcile optimistic checkbox state with the persisted annotation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(annotationChecked);
  }, [annotationChecked]);

  function handleToggleWatchLater() {
    if (!isSignedIn) {
      toast.info("Sign in to save resources for later.");
      return;
    }
    onToggleReadLater?.(resource.id);
  }

  function handleUpdateAnnotation(patch: ResourceAnnotationPatch) {
    if (!isSignedIn) {
      toast.info("Sign in to edit resource notes.");
      return;
    }
    if (typeof patch.checked === "boolean") setChecked(patch.checked);
    onUpdateAnnotation?.(resource.id, patch);
  }

  function renderCommentAction() {
    if (!showAnnotationActions || showSelectionControl) return null;

    return (
      <ResourceCardCommentButton
        onClick={() => {
          if (!isSignedIn) {
            toast.info("Sign in to edit resource notes.");
            return;
          }
          setCommentEditorOpen((open) => !open);
        }}
      />
    );
  }

  function renderCommentEditor() {
    if (!showAnnotationActions || !commentEditorOpen) return null;

    return (
      <ResourceCardCommentEditor
        onCancel={() => {
          setLocalCommentDraft(annotation?.comment ?? "");
          setCommentEditorOpen(false);
        }}
        onChange={setLocalCommentDraft}
        onSave={() => {
          const comment = localCommentDraft.trim();
          setLocalCommentDraft(comment);
          handleUpdateAnnotation({ comment });
          setCommentEditorOpen(false);
        }}
        value={localCommentDraft}
      />
    );
  }

  function renderSharedAnnotationActions() {
    if (showSelectionControl) return undefined;

    return (
      <ResourceCardActions
        disabled={disabled || downloadingMedia}
        isChecked={checked}
        isReadLater={isWatchedLater}
        isStarred={resource.isStarred}
        onRatingChange={
          showAnnotationActions
            ? (value) =>
                handleUpdateAnnotation({ rating: value > 0 ? value : null })
            : undefined
        }
        onToggleChecked={
          showAnnotationActions
            ? (nextChecked) => handleUpdateAnnotation({ checked: nextChecked })
            : undefined
        }
        onToggleReadLater={
          showReadLaterAction ? handleToggleWatchLater : undefined
        }
        onToggleStar={
          showStarAction
            ? () => {
                if (!isSignedIn) {
                  toast.info("Sign in to star resources.");
                  return;
                }
                onToggleStar();
              }
            : undefined
        }
        leadingAction={renderMagnetTreeAction()}
        rating={rating}
        section="annotation"
      />
    );
  }

  function renderCardHeaderActions() {
    if (showSelectionControl) return undefined;
    return renderSharedAnnotationActions();
  }

  function renderTransferDialog() {
    if (!isVaultOwner) return null;

    return (
      <ResourceTransferDialog
        disabled={disabled}
        focusedSpaceId={transferFocusSpaceId}
        onCreateSpace={onCreateTransferTargetSpace}
        onLoadTargets={onLoadTransferTargets}
        onOpenChange={setTransferOpen}
        onTransfer={async (input) => {
          setTransferOpen(false);
          await onTransferResource({ ...input, resourceId: resource.id });
        }}
        open={transferOpen}
        resourceTitle={title}
        showTrigger={false}
        sourceSpaceId={resource.spaceId ?? spaceId}
        targets={transferTargets}
      />
    );
  }

  function renderSharedManagementActions() {
    if (
      showSelectionControl ||
      (downloadableMedia.length === 0 &&
        !canDeleteResource &&
        !canEditResource &&
        !isVaultOwner)
    ) {
      return undefined;
    }

    return (
      <ResourceCardActions
        disabled={disabled || downloadingMedia}
        onDelete={
          canDeleteResource ? () => setSpecialDeleteOpen(true) : undefined
        }
        onDownload={
          downloadableMedia.length > 0
            ? () => void handleDownloadAllMedia()
            : undefined
        }
        onEdit={canEditResource ? onOpenDetails : undefined}
        onMove={
          isVaultOwner
            ? () => {
                setTransferOpen(true);
                if (transferTargets.length === 0) {
                  void onLoadTransferTargets().catch(() => undefined);
                }
              }
            : undefined
        }
        onRetryMetadata={
          canEditResource &&
          Boolean(onResolveMetadata) &&
          resource.type !== "local_media" &&
          !isResolvingMetadata
            ? () => setMetadataRetryOpen(true)
            : undefined
        }
        section="management"
      />
    );
  }

  function renderDeleteDialog() {
    if (!canDeleteResource) return null;

    return (
      <AlertDialog open={specialDeleteOpen} onOpenChange={setSpecialDeleteOpen}>
        <AlertDialogContent className="gap-0 rounded-none border border-border bg-card p-0 text-foreground">
          <AlertDialogHeader className="px-4 py-4">
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the resource from the current space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none border-border bg-background/40 px-4 py-3">
            <AlertDialogCancel
              render={
                <BaseButton
                  className="[transform:none!important]"
                  size="sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              Cancel
            </AlertDialogCancel>
            <BaseButton
              className="[transform:none!important]"
              size="sm"
              type="button"
              variant="destructive"
              onClick={() => {
                setSpecialDeleteOpen(false);
                onDelete();
              }}
            >
              Delete
            </BaseButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  function renderMetadataRetryDialog() {
    if (!onResolveMetadata) return null;

    return (
      <AlertDialog open={metadataRetryOpen} onOpenChange={setMetadataRetryOpen}>
        <AlertDialogContent className="gap-0 rounded-none border border-border bg-card p-0 text-foreground">
          <AlertDialogHeader className="px-4 py-4">
            <AlertDialogTitle>Retrieve metadata again?</AlertDialogTitle>
            <AlertDialogDescription>
              The resource metadata will be refreshed from its source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 rounded-none border-border bg-background/40 px-4 py-3">
            <AlertDialogCancel
              render={
                <BaseButton
                  className="[transform:none!important]"
                  size="sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              Cancel
            </AlertDialogCancel>
            <BaseButton
              className="[transform:none!important]"
              size="sm"
              type="button"
              variant="default"
              onClick={() => {
                setMetadataRetryOpen(false);
                onResolveMetadata();
              }}
            >
              Retrieve metadata
            </BaseButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  function renderMagnetTreeAction() {
    if (magnetFileTree.length === 0) return null;

    return (
      <Popover open={magnetTreeOpen} onOpenChange={setMagnetTreeOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-label="View file tree"
              className="size-6 !rounded-sm bg-secondary text-secondary-foreground hover:bg-muted [&_svg]:size-3.5"
              disabled={disabled}
              onClick={(event: MouseEvent) => event.stopPropagation()}
              onMouseEnter={openMagnetTreeOnHover}
              onMouseLeave={closeMagnetTreeOnHover}
              size="icon-xs"
              title="View file tree"
              type="button"
              variant="ghost"
            >
              <FolderTree />
            </Button>
          }
        />
        <PopoverContent
          className="w-[min(92vw,32rem)] border-border bg-card p-0 text-foreground"
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={openMagnetTreeOnHover}
          onMouseLeave={closeMagnetTreeOnHover}
        >
          <div className="flex h-9 items-center justify-between border-b border-border px-3">
            <PopoverTitle className="font-mono text-label font-normal uppercase tracking-[.12em] text-muted-foreground">
              File tree
            </PopoverTitle>
            <BaseBadge variant="default">{magnetFileTree.length}</BaseBadge>
          </div>
          <ResourceFileTree nodes={magnetFileTree} />
        </PopoverContent>
      </Popover>
    );
  }

  function renderLeadingControl(className?: string) {
    if (showSelectionControl) {
      return (
        <BaseCheckbox
          aria-label={isSelected ? "Deselect resource" : "Select resource"}
          checked={isSelected}
          className={cn(
            "!size-5 border-[color:var(--andromeda-border-base)] bg-[color:var(--andromeda-surface-raised)] p-0 transition hover:border-[color:var(--andromeda-border-bright)] focus-visible:border-[color:var(--andromeda-accent-400)]",
            className,
          )}
          onClick={(event: MouseEvent) => event.stopPropagation()}
          onCheckedChange={(value: boolean) =>
            onToggleSelected?.(value === true)
          }
        />
      );
    }

    if (isVaultOwner) {
      return (
        <button
          className={cn(
            "relative grid  shrink-0 cursor-grab place-items-center overflow-hidden bg-muted transition hover:border-border hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          disabled={disabled}
          ref={handleRef}
          type="button"
        >
          <ResourceIcon
            className="size-4 transition group-hover/resource-card:opacity-0"
            iconComponent={iconComponent}
            fallbackIconSrc={fallbackIconSrc}
            iconSrc={iconSrc}
            label={iconLabel}
          />
          <GripVertical className="absolute size-3 text-muted-foreground opacity-0 transition group-hover/resource-card:opacity-100" />
          <span className="sr-only">Drag to reorder resource</span>
        </button>
      );
    }

    return (
      <span
        className={cn(
          "relative grid size-5 shrink-0 place-items-center overflow-hidden  border-border bg-muted",
          className,
        )}
      >
        <ResourceIcon
          className="size-5"
          iconComponent={iconComponent}
          fallbackIconSrc={fallbackIconSrc}
          iconSrc={iconSrc}
          label={iconLabel}
        />
      </span>
    );
  }

  function renderExternalLinkAction(className?: string) {
    return (
      <AlertDialog open={externalOpen} onOpenChange={setExternalOpen}>
        <AlertDialogTrigger
          render={
            <button
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center border border-transparent text-muted-foreground transition hover:bg-muted hover:text-primary [&_svg]:size-3",
                className,
              )}
              onClick={(event) => event.stopPropagation()}
              type="button"
            >
              <ExternalLink />
              <span className="sr-only">Open source link</span>
            </button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open external link</AlertDialogTitle>
            <AlertDialogDescription>
              You are leaving NexusVault for a third-party site. Confirm the
              source before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mono max-w-full truncate border border-border bg-background px-2.5 py-2 text-label text-muted-foreground">
            {displayUrl}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExternalOpen(false);
                window.open(displayUrl, "_blank", "noopener,noreferrer");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  function renderRefererLinkAction(className?: string) {
    if (!refererUrl || resource.type === "local_media") return null;

    return (
      <a
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center border border-border text-muted-foreground transition hover:bg-muted hover:text-primary [&_svg]:size-3",
          className,
        )}
        href={refererUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title="Open referer"
      >
        <LinkIcon />
        <span className="sr-only">Open referer</span>
      </a>
    );
  }

  if (specializedPreview) {
    return (
      <>
        <ResourcePreviewCard
          actions={renderCardHeaderActions()}
          annotation={
            !showSelectionControl && showAnnotationActions && !commentEditorOpen
              ? localCommentDraft || undefined
              : undefined
          }
          articleId={`resource-${resource.id}`}
          articleRef={ref}
          className={cn(
            "group/resource-card",
            isResolvingMetadata && "border-border bg-muted/80",
            isActive && "border-primary bg-primary/10 hover:border-primary",
            className,
          )}
          commentAction={renderCommentAction()}
          commentEditor={renderCommentEditor()}
          footerActions={renderSharedManagementActions()}
          leadingControl={
            showSelectionControl || isVaultOwner
              ? renderLeadingControl(
                  "size-5 [&_img]:size-4 [&_span.mono]:text-[8px]",
                )
              : undefined
          }
          mediaVisible={mediaVisible}
          onActivate={
            showSelectionControl
              ? () => onToggleSelected?.(!isSelected)
              : undefined
          }
          preview={specializedPreview}
          state={specializedPreviewState}
          viewMode={viewMode}
        />

        {renderDeleteDialog()}
        {renderMetadataRetryDialog()}

        {renderTransferDialog()}
      </>
    );
  }

  return (
    <>
      <ResourceCardFrame
        actions={renderCardHeaderActions()}
        annotation={
          !showSelectionControl && showAnnotationActions && !commentEditorOpen
            ? localCommentDraft || undefined
            : undefined
        }
        articleId={`resource-${resource.id}`}
        articleRef={ref}
        className={cn(
          "group/resource-card",
          isResolvingMetadata && "border-border bg-muted/80",
          isActive && "border-primary bg-primary/10 hover:border-primary",
          className,
        )}
        commentAction={renderCommentAction()}
        commentEditor={renderCommentEditor()}
        footerActions={renderSharedManagementActions()}
        leadingControl={renderLeadingControl(
          "size-5 [&_img]:size-4 [&_span.mono]:text-[8px]",
        )}
        onActivate={
          showSelectionControl
            ? () => onToggleSelected?.(!isSelected)
            : undefined
        }
        sourceIcon={
          <ResourceIcon
            className="size-5"
            iconComponent={iconComponent}
            fallbackIconSrc={fallbackIconSrc}
            iconSrc={iconSrc}
            label={iconLabel}
          />
        }
        sourceName={resourceTypeLabel}
        sourceLabelVariant="plain"
        state={specializedPreviewState}
        url={resourceLinkUrl || displayUrl}
        viewMode={viewMode}
      >
        <>
          {/* title */}
          {isMasonryView ? (
            <span className="block w-full min-w-0 text-left text-sm font-semibold leading-5 text-foreground wrap-break-word">
              {title}
            </span>
          ) : (
            <BaseTooltip
              className="min-w-0 flex-1"
              label={title}
              style={{ display: "flex", width: "100%" }}
            >
              <span className="block w-full min-w-0 truncate text-left text-sm font-semibold leading-6 text-foreground">
                {title}
              </span>
            </BaseTooltip>
          )}
          {/* url */}
          {resourceLinkUrl && (
            <div
              className="flex min-w-0 items-center gap-1.5"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="mono min-w-0 flex-1 truncate rounded-input border border-border bg-background px-2 py-1 text-left text-label text-muted-foreground transition hover:text-primary hover:underline"
                onClick={() => void copyDisplayUrl()}
                title="Copy link"
                type="button"
              >
                {resourceLinkUrl}
              </button>
              {renderExternalLinkAction(
                "size-6 border border-border bg-card hover:border-primary hover:bg-muted",
              )}
              {renderRefererLinkAction(
                "size-6 border border-border bg-card hover:border-primary hover:bg-muted",
              )}
            </div>
          )}
          {/* description */}
          <ResourceDescription
            aiSummary={aiSummary}
            description={description}
          />
          {/* processing status bar  */}
          {isResolvingMetadata && (
            <ProgressBar className="w-full" isIndeterminate />
          )}
          {/* media  */}
          {mediaVisible && media.length > 0 && !isResolvingMetadata && (
            <ResourceMediaGallery
              media={media}
              title={title}
              variant={isMasonryView ? "carousel" : "scroll"}
            />
          )}
          {/* metadata  */}
          {pills.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <ResourceMetadataPill
                  key={pill.key}
                  onCopy={copyPillValue}
                  pill={pill}
                />
              ))}
            </div>
          )}
        </>
      </ResourceCardFrame>
      {renderDeleteDialog()}
      {renderMetadataRetryDialog()}
      {renderTransferDialog()}
    </>
  );
}

function ResourceMetadataPill({
  onCopy,
  pill,
}: {
  onCopy: (value: string) => void;
  pill: ResourcePillItem;
}) {
  if (pill.kind === "status") {
    return (
      <BaseBadge
        title={pill.title}
        variant={
          pill.status === "offline"
            ? "fault"
            : pill.status === "online"
              ? "accent"
              : "outline"
        }
      >
        {pill.label}
      </BaseBadge>
    );
  }

  if (pill.kind === "copy") {
    return (
      <BaseTag className={metadataPillClassName} variant="default">
        <span>{pill.label}</span>
        <span className="text-muted-foreground">{pill.value}</span>
        <button
          aria-label={pill.ariaLabel}
          className="-mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center text-muted-foreground transition hover:bg-muted hover:text-primary [&_svg]:size-2"
          onClick={() => onCopy(pill.value)}
          type="button"
        >
          <Copy />
        </button>
      </BaseTag>
    );
  }

  return (
    <BaseTag className={metadataPillClassName} variant="accent">
      {pill.label}
    </BaseTag>
  );
}

function getDownloadableResourceMedia(resource: Resource) {
  return getResourceMedia(resource).filter(
    (item) =>
      typeof item.src === "string" &&
      (item.src.startsWith("/") || /^https?:\/\//i.test(item.src)),
  );
}

function getResourceTypeLabel(type: Resource["type"]) {
  return resourceTypes.find((item) => item.value === type)?.label ?? type;
}

async function downloadResourceMedia(item: { src: string; alt?: string }) {
  const response = await fetch(item.src, { credentials: "include" });
  if (!response.ok)
    throw new Error(`Download failed with status ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = item.alt?.trim() || "resource-media";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function normalizeTransferQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getFilteredTransferTargets(
  targets: ResourceTransferTargetVault[],
  query: string,
) {
  if (!query) return targets;

  return targets
    .map((target) => {
      const vaultMatches = normalizeTransferQuery(target.title).includes(query);
      const spaces = vaultMatches
        ? target.spaces
        : target.spaces.filter((space) =>
            normalizeTransferQuery(space.name).includes(query),
          );

      return {
        ...target,
        spaces,
      };
    })
    .filter(
      (target) =>
        normalizeTransferQuery(target.title).includes(query) ||
        target.spaces.length > 0,
    );
}

export function ResourceTransferDialog({
  disabled,
  focusedSpaceId,
  onCreateSpace,
  onLoadTargets,
  onOpenChange,
  onTransfer,
  open,
  resourceTitle,
  showTrigger = true,
  showTriggerLabel = false,
  sourceSpaceId,
  targets,
  triggerClassName,
  triggerLabel = "Move or copy",
}: {
  disabled: boolean;
  focusedSpaceId?: string;
  onCreateSpace: (vaultId: string) => void;
  onLoadTargets: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onTransfer: (input: {
    action: "move" | "copy";
    targetVaultId: string;
    targetSpaceId: string;
  }) => Promise<void>;
  open: boolean;
  resourceTitle: string;
  showTrigger?: boolean;
  showTriggerLabel?: boolean;
  sourceSpaceId: string;
  targets: ResourceTransferTargetVault[];
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [busyKey, setBusyKey] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeTransferQuery(query);
  const filteredTargets = getFilteredTransferTargets(targets, normalizedQuery);
  const treeKey = targets
    .map(
      (target) =>
        `${target.id}:${target.spaces.map((space) => space.id).join(",")}`,
    )
    .join("|");

  useEffect(() => {
    if (!open || !focusedSpaceId) return;

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-transfer-space-id="${CSS.escape(focusedSpaceId)}"]`,
        )
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [focusedSpaceId, open, targets]);

  async function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      return;
    }
    if (!nextOpen || targets.length > 0) return;

    setLoadingTargets(true);
    try {
      await onLoadTargets();
    } finally {
      setLoadingTargets(false);
    }
  }

  async function handleTransfer(input: {
    action: "move" | "copy";
    targetVaultId: string;
    targetSpaceId: string;
  }) {
    if (input.targetSpaceId === sourceSpaceId) {
      setQuery("");
      onOpenChange(false);
      toast.info("This resource is already in that space.");
      return;
    }

    const key = `${input.action}:${input.targetSpaceId}`;
    setBusyKey(key);
    try {
      setQuery("");
      onOpenChange(false);
      await onTransfer(input);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => void handleOpenChange(value)}>
      {showTrigger && (
        <BaseButton
          className={cn(
            !showTriggerLabel &&
              "h-5 w-5 border border-transparent p-0 text-muted-foreground hover:text-primary [transform:none!important] [&_svg]:size-3",
            triggerClassName,
          )}
          disabled={disabled}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            void handleOpenChange(true);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <FolderInput />
          {showTriggerLabel ? (
            <span>{triggerLabel}</span>
          ) : (
            <span className="sr-only">{triggerLabel}</span>
          )}
        </BaseButton>
      )}
      <DialogContent className="max-h-[min(680px,calc(100dvh-2rem))] overflow-hidden rounded-none border-border bg-card p-0 gap-0 text-foreground sm:max-w-[520px]">
        <DialogHeader className="min-w-0 border-b border-border px-4 py-3">
          <DialogTitle className="font-display">Move or copy</DialogTitle>
          <DialogDescription className="block min-w-0 max-w-full truncate text-muted-foreground">
            {resourceTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoComplete="off"
              className="h-8 border-border bg-background pl-8 text-ui text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              disabled={loadingTargets || targets.length === 0}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter vaults or spaces"
              value={query}
            />
          </div>
        </div>
        <ScrollArea className="max-h-[min(520px,calc(100dvh-12rem))]">
          <div className="p-2">
            {loadingTargets ? (
              <div className="flex min-h-32 items-center justify-center text-ui text-muted-foreground">
                Loading vaults...
              </div>
            ) : filteredTargets.length > 0 ? (
              <TreeProvider
                defaultExpandedIds={filteredTargets.map((target) => target.id)}
                key={`${treeKey}:${focusedSpaceId ?? ""}:${normalizedQuery}`}
                selectable={false}
                showLines={false}
              >
                <TreeView className="p-0">
                  {filteredTargets.map((vault, vaultIndex) => (
                    <TreeNode
                      isLast={vaultIndex === filteredTargets.length - 1}
                      key={vault.id}
                      nodeId={vault.id}
                    >
                      <TreeNodeTrigger className="min-w-0 rounded-none border border-transparent px-2 py-2 hover:border-border hover:bg-muted">
                        <TreeExpander hasChildren={vault.spaces.length > 0} />
                        <TreeLabel className="min-w-0 text-ui font-semibold text-foreground">
                          {vault.title}
                        </TreeLabel>
                        <span className="mono shrink-0 text-[10px] text-muted-foreground">
                          {vault.spaces.length}
                        </span>
                        <Button
                          className="ml-1 size-6 shrink-0 opacity-0 transition group-hover:opacity-100 active:translate-y-0 [&_svg]:size-3.5"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCreateSpace(vault.id);
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <Plus />
                          <span className="sr-only">
                            Create a space in this vault
                          </span>
                        </Button>
                      </TreeNodeTrigger>
                      <TreeNodeContent hasChildren={vault.spaces.length > 0}>
                        {vault.spaces.map((space, spaceIndex) => {
                          const moveKey = `move:${space.id}`;
                          const copyKey = `copy:${space.id}`;

                          return (
                            <TreeNode
                              isLast={spaceIndex === vault.spaces.length - 1}
                              key={space.id}
                              level={1}
                              nodeId={space.id}
                            >
                              <TreeNodeTrigger
                                className={cn(
                                  "group/transfer-space min-w-0 rounded-none border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted",
                                  focusedSpaceId === space.id &&
                                    "border border-primary/70 bg-primary/10",
                                )}
                                data-transfer-space-id={space.id}
                              >
                                <TreeExpander />
                                <TreeIcon
                                  className="mr-2 text-primary [&_svg]:size-4"
                                  icon={<SpaceIcon name={space.icon} />}
                                />
                                <TreeLabel className="min-w-0 text-ui text-muted-foreground">
                                  {space.name}
                                </TreeLabel>
                                <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition group-hover/transfer-space:opacity-100">
                                  <Button
                                    className={transferActionClass}
                                    disabled={Boolean(busyKey)}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleTransfer({
                                        action: "move",
                                        targetVaultId: vault.id,
                                        targetSpaceId: space.id,
                                      });
                                    }}
                                    size="xs"
                                    type="button"
                                    variant="ghost"
                                  >
                                    {busyKey === moveKey ? "Moving" : "Move"}
                                  </Button>
                                  <Button
                                    className={transferCopyActionClass}
                                    disabled={Boolean(busyKey)}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleTransfer({
                                        action: "copy",
                                        targetVaultId: vault.id,
                                        targetSpaceId: space.id,
                                      });
                                    }}
                                    size="xs"
                                    type="button"
                                    variant="ghost"
                                  >
                                    {busyKey === copyKey ? "Copying" : "Copy"}
                                  </Button>
                                </div>
                              </TreeNodeTrigger>
                            </TreeNode>
                          );
                        })}
                      </TreeNodeContent>
                    </TreeNode>
                  ))}
                </TreeView>
              </TreeProvider>
            ) : (
              <div className="flex min-h-32 items-center justify-center border border-dashed border-border text-ui text-muted-foreground">
                {normalizedQuery ? "No matching spaces" : "No spaces available"}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const metadataPillClassName = "max-w-full";

function ResourceIcon({
  className,
  iconComponent: Icon,
  fallbackIconSrc,
  iconSrc,
  label = "LINK",
}: {
  className?: string;
  iconComponent?: ComponentType<SVGProps<SVGSVGElement>>;
  fallbackIconSrc?: string;
  iconSrc?: string;
  label?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (Icon) {
    return <Icon aria-hidden="true" className={cn("size-5", className)} />;
  }

  const imageSrc = failed ? fallbackIconSrc : (iconSrc ?? fallbackIconSrc);
  if (imageSrc) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn("size-5 object-contain", className)}
        onError={() => setFailed(true)}
        src={imageSrc}
      />
    );
  }

  return (
    <IconLink
      aria-label={label}
      className={cn("size-5 opacity-75", className)}
    />
  );
}

function getResourceIconComponent(resource: Resource) {
  const mapped =
    resourceTypeIconMap[resource.type as keyof typeof resourceTypeIconMap];
  if (mapped) return mapped;

  const protocol = getResourceProtocol(resource.url);
  if (protocol === "ed2k") return IconEmule;
  if (protocol === "thunder") return IconThunder;
  if (getGithubHost(resource.url)) return IconGithub;

  return undefined;
}

function getResourceMetadataFavicon(resource: Resource) {
  const extra = resource.metadata?.data?.extra;
  if (!extra || typeof extra !== "object") return undefined;
  const http = (extra as Record<string, unknown>).http;
  if (!http || typeof http !== "object") return undefined;
  const favicon = (http as Record<string, unknown>).favicon;
  return typeof favicon === "string" && favicon.trim()
    ? favicon.trim()
    : undefined;
}

function getGithubHost(url: string | null | undefined) {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase() === "github.com";
  } catch {
    return false;
  }
}

function getResourceProtocol(url: string | null | undefined) {
  const value = typeof url === "string" ? url.trim().toLowerCase() : "";
  if (value.startsWith("ed2k://")) return "ed2k";
  if (value.startsWith("ftp://")) return "ftp";
  if (value.startsWith("thunder://")) return "thunder";
  return undefined;
}

function getResourceAiSummary(value: unknown): ResourceAiSummary | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (
    state.status !== "pending" &&
    state.status !== "processing" &&
    state.status !== "completed" &&
    state.status !== "failed"
  ) {
    return null;
  }
  return {
    status: state.status,
    text: typeof state.text === "string" ? state.text : undefined,
  };
}

function getHttpUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
