/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Info,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge as BadgePrimitive } from "@/components/aicanvas/andromeda/components/Badge";
import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import { PanelMenu as PanelMenuPrimitive } from "@/components/aicanvas/andromeda/components/PanelMenu";
import { InfiniteMasonry } from "@/components/motion/infinite-masonry";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast";
import { ResourceMarkdown } from "@/features/resource/components/resource-description";
import type { ResourceTransferTargetVault } from "@/features/resource/types";
import {
  SpaceIcon,
  SpaceIconPicker,
} from "@/features/resource/space-icon-picker";
import { SpaceTransferDialog } from "./space-transfer-dialog";
import type { Resource } from "@/features/resource/types";

const Badge: any = BadgePrimitive;
const Button: any = ButtonPrimitive;
const PanelMenu: any = PanelMenuPrimitive;
const sectionIconButtonClass =
  "size-6 border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground [transform:none!important] [&_svg]:size-3.5 [&_svg]:scale-100 [&_svg]:transition-none";

export type SpaceDragData = { kind: "space"; spaceId: string };

export type SpaceSectionResource = Resource;

export type SpaceSectionProps = {
  index: number;
  collapsed?: boolean;
  disabled?: boolean;
  canAddResource?: boolean;
  isVaultOwner?: boolean;
  resources: SpaceSectionResource[];
  space: { id: string; name: string; description?: string; icon?: string };
  viewMode?: "list" | "masonry";
  selectedResourceIds?: Set<string>;
  selectionMode?: boolean;
  onAddResource?: () => void;
  onDeleteSpace?: () => void;
  onEditSpace?: () => void;
  onToggleCollapsed?: () => void;
  onToggleSelectionMode?: () => void;
  onToggleResourceSelected?: (resourceId: string, selected: boolean) => void;
  onLoadTransferTargets?: () => Promise<void>;
  onTransferSpace?: (spaceId: string, targetVaultId: string) => Promise<void>;
  onUpdateIcon?: (icon: string) => void | Promise<void>;
  renderResource?: (
    resource: SpaceSectionResource,
    index: number,
    selection?: {
      isSelected: boolean;
      onToggleSelected: (selected: boolean) => void;
    },
  ) => ReactNode;
  sourceVaultId?: string;
  transferTargets?: ResourceTransferTargetVault[];
};

export function SpaceSection({
  collapsed = false,
  disabled = false,
  canAddResource = false,
  isVaultOwner = false,
  index,
  resources,
  space,
  viewMode = "list",
  selectedResourceIds = new Set(),
  selectionMode = false,
  onAddResource,
  onDeleteSpace,
  onEditSpace,
  onToggleCollapsed,
  onToggleSelectionMode,
  onToggleResourceSelected,
  onLoadTransferTargets,
  onTransferSpace,
  onUpdateIcon,
  renderResource,
  sourceVaultId,
  transferTargets = [],
}: SpaceSectionProps) {
  const [icon, setIcon] = useState(space.icon || "tv");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const descriptionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { handleRef, ref } = useSortable<SpaceDragData>({
    id: `space:${space.id}`,
    index,
    group: "spaces",
    type: "space",
    accept: "space",
    data: { kind: "space", spaceId: space.id },
    disabled: disabled || !isVaultOwner,
  });
  const selectedCount = resources.filter((resource) =>
    selectedResourceIds.has(resource.id),
  ).length;
  const menuItems = [
    { label: "Edit", icon: Pencil, onSelect: onEditSpace },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onSelect: onDeleteSpace,
    },
  ];

  async function copyLinks() {
    const links = resources
      .map((resource) => resource.url ?? resource.referer)
      .filter((url): url is string => Boolean(url));
    if (!links.length) {
      toast.info("No links to copy");
      return;
    }
    const value = links.join("\n");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    toast.success(`${links.length} link${links.length === 1 ? "" : "s"} copied`);
  }

  function changeIcon(nextIcon: string) {
    setIcon(nextIcon);
    void onUpdateIcon?.(nextIcon);
  }

  function openDescription() {
    if (descriptionCloseTimerRef.current)
      clearTimeout(descriptionCloseTimerRef.current);
    setDescriptionOpen(true);
  }

  function scheduleDescriptionClose() {
    if (descriptionCloseTimerRef.current)
      clearTimeout(descriptionCloseTimerRef.current);
    descriptionCloseTimerRef.current = setTimeout(
      () => setDescriptionOpen(false),
      120,
    );
  }

  useEffect(
    () => () => {
      if (descriptionCloseTimerRef.current)
        clearTimeout(descriptionCloseTimerRef.current);
    },
    [],
  );

  return (
    <section
      ref={ref}
      className={`group mb-3 border-x border-b border-border bg-background px-2 ${collapsed ? "opacity-95" : ""}`}
      id={`space-${space.id}`}
      data-space-section
    >
      <div className="vault-detail-page__space-header -mx-2 flex items-center gap-1 border-y border-border px-2">
        {isVaultOwner ? (
          <button
            aria-label="Drag to reorder space"
            className="group/space-handle grid size-6 shrink-0 cursor-grab place-items-center text-primary transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            ref={handleRef}
            type="button"
          >
            <span className="group-hover/space-handle:hidden">
              <SpaceIcon className="size-4" name={icon} />
            </span>
            <GripVertical className="hidden size-4 group-hover/space-handle:block" />
          </button>
        ) : (
          <span className="grid size-6 shrink-0 place-items-center text-primary">
            <SpaceIcon className="size-4" name={icon} />
          </span>
        )}
        <Button
          aria-label={collapsed ? "Expand space" : "Collapse space"}
          className={sectionIconButtonClass}
          disabled={disabled}
          icon={collapsed ? ChevronRight : ChevronDown}
          onClick={onToggleCollapsed}
          size="sm"
          type="button"
          variant="ghost"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="flex min-h-6 items-center truncate font-mono text-sm font-medium leading-none text-foreground">
            {space.name}
          </h2>
          <span className="font-mono text-label text-muted-foreground">
            {resources.length}
          </span>
          {selectedCount > 0 ? (
            <Badge variant="accent">{selectedCount} selected</Badge>
          ) : null}
          {space.description ? (
            <Popover open={descriptionOpen} onOpenChange={setDescriptionOpen}>
              <PopoverTrigger
                onBlur={scheduleDescriptionClose}
                onFocus={openDescription}
                onMouseEnter={openDescription}
                onMouseLeave={scheduleDescriptionClose}
                render={
                  <Button
                    aria-label="View space description"
                    className={sectionIconButtonClass}
                    icon={Info}
                    size="sm"
                    type="button"
                    variant="ghost"
                  />
                }
              />
              <PopoverContent
                align="start"
                className="w-[min(28rem,calc(100vw-2rem))] gap-0 border border-border bg-card p-0 text-foreground"
                onMouseEnter={openDescription}
                onMouseLeave={scheduleDescriptionClose}
                side="bottom"
              >
                <PopoverHeader className="border-b border-border px-3 py-2">
                  <PopoverTitle className="font-mono text-label font-medium uppercase tracking-[.12em] text-muted-foreground">
                    Description
                  </PopoverTitle>
                </PopoverHeader>
                <ScrollArea className="max-h-72 px-3 py-2">
                  <ResourceMarkdown
                    className="text-xs leading-5 text-muted-foreground"
                    value={space.description ?? ""}
                  />
                </ScrollArea>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
        <div
          className={`flex items-center gap-0.5 transition ${selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          {isVaultOwner && resources.length > 0 ? (
            <Button
              aria-label="Select resources"
              className={sectionIconButtonClass}
              disabled={disabled}
              icon={ListChecks}
              onClick={onToggleSelectionMode}
              size="sm"
              type="button"
              variant="ghost"
            />
          ) : null}
          {resources.length > 0 ? (
            <Button
              aria-label="Copy all links"
              className={sectionIconButtonClass}
              disabled={disabled}
              icon={Copy}
              onClick={() => void copyLinks()}
              size="sm"
              type="button"
              variant="ghost"
            />
          ) : null}
          {canAddResource ? (
            <Button
              aria-label="Add resource"
              className={sectionIconButtonClass}
              disabled={disabled}
              icon={Plus}
              onClick={onAddResource}
              size="sm"
              type="button"
              variant="ghost"
            />
          ) : null}
          {isVaultOwner ? (
            <>
              {sourceVaultId && onLoadTransferTargets && onTransferSpace ? (
                <SpaceTransferDialog
                  disabled={disabled}
                  onLoadTargets={onLoadTransferTargets}
                  onMove={(targetVaultId) =>
                    onTransferSpace(space.id, targetVaultId)
                  }
                  sourceVaultId={sourceVaultId}
                  spaceName={space.name}
                  targets={transferTargets}
                />
              ) : null}
              <SpaceIconPicker
                disabled={disabled}
                onSelect={changeIcon}
                trigger="action"
                triggerClassName={sectionIconButtonClass}
                value={icon}
              />
              <PanelMenu
                ariaLabel="Space actions"
                items={menuItems}
                triggerClassName={sectionIconButtonClass}
              />
            </>
          ) : null}
        </div>
      </div>
      {!collapsed ? (
        <div className="min-h-20 border-border py-2">
          {viewMode === "masonry" && resources.length > 0 ? (
            <InfiniteMasonry
              ariaLabel={`${space.name} resources`}
              className="!min-h-20 !overflow-visible rounded-none border-0 bg-transparent p-0"
              contentClassName="min-h-20"
              endState={null}
              getItemKey={(resource) => resource.id}
              hasMore={false}
              items={resources}
              minColumnWidth={220}
              maxColumns={4}
              gap={8}
              onLoadMore={() => undefined}
              renderItem={(resource, index) => (
                <div>
                  {renderResource ? (
                    renderResource(
                      resource,
                      index,
                      selectionMode
                        ? {
                            isSelected: selectedResourceIds.has(resource.id),
                            onToggleSelected: (selected) =>
                              onToggleResourceSelected?.(resource.id, selected),
                          }
                        : undefined,
                    )
                  ) : (
                    <FallbackResourceRow resource={resource} />
                  )}
                </div>
              )}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {resources.map((resource, index) =>
                renderResource ? (
                  <div key={resource.id}>
                    {renderResource(
                      resource,
                      index,
                      selectionMode
                        ? {
                            isSelected: selectedResourceIds.has(resource.id),
                            onToggleSelected: (selected) =>
                              onToggleResourceSelected?.(resource.id, selected),
                          }
                        : undefined,
                    )}
                  </div>
                ) : (
                  <FallbackResourceRow key={resource.id} resource={resource} />
                ),
              )}
            </div>
          )}
          {resources.length === 0 ? (
            <button
              className="flex min-h-24 w-full flex-col items-center justify-center gap-2 border border-dashed border-border p-4 text-center text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
              disabled={disabled}
              onClick={onAddResource}
              type="button"
            >
              <Plus className="size-5" />
              <span className="text-ui font-medium">
                {canAddResource
                  ? `Add a resource to ${space.name}`
                  : `No resources in ${space.name} yet`}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FallbackResourceRow({ resource }: { resource: SpaceSectionResource }) {
  const metadata = resource.metadata?.data;
  const summary = [
    metadata?.fileType,
    typeof metadata?.fileCount === "number"
      ? `${metadata.fileCount} files`
      : undefined,
    typeof metadata?.size === "number" ? formatBytes(metadata.size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-1 border border-border bg-card px-3 py-2 text-ui">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-foreground">
          {resource.title || resource.url || "Untitled resource"}
        </span>
        <span className="shrink-0 text-label text-muted-foreground">
          {resource.metadataStatus || "ready"}
        </span>
      </div>
      {resource.url ? (
        <a
          className="truncate text-label text-primary hover:underline"
          href={resource.url}
          rel="noreferrer"
          target="_blank"
        >
          {resource.url}
        </a>
      ) : null}
      {resource.description ? (
        <p className="line-clamp-2 text-label leading-5 text-muted-foreground">
          {resource.description}
        </p>
      ) : null}
      {summary ? (
        <p className="text-label text-muted-foreground">{summary}</p>
      ) : null}
    </article>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
