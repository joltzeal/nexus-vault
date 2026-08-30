/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  LayoutGrid,
  List,
  ListTree,
  Plus,
} from "lucide-react";

import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import {
  Drawer as DrawerPrimitive,
  DrawerBody as DrawerBodyPrimitive,
  DrawerHeader as DrawerHeaderPrimitive,
  DrawerTitle as DrawerTitlePrimitive,
} from "@/components/aicanvas/andromeda/components/Drawer";
import { IconButton as IconButtonPrimitive } from "@/components/aicanvas/andromeda/components/IconButton";
import { ResourceTransferDialog } from "@/features/resource/components";
import type { ResourceTransferTargetVault } from "@/features/resource/types";
import { SpaceIcon } from "@/features/resource/space-icon-picker";
import type { VaultDetail } from "../api/vault-api";

const Button: any = ButtonPrimitive;
const Drawer: any = DrawerPrimitive;
const DrawerBody: any = DrawerBodyPrimitive;
const DrawerHeader: any = DrawerHeaderPrimitive;
const DrawerTitle: any = DrawerTitlePrimitive;
const IconButton: any = IconButtonPrimitive;

export type VaultViewMode = "list" | "masonry";

export function VaultOutline({
  detail,
  disabled = false,
  onAddSpace,
  allSpacesCollapsed = false,
  onToggleAllSpaces,
  onViewModeChange,
  onBatchTransfer,
  onCreateTransferTargetSpace,
  onLoadTransferTargets,
  selectedResourceIds = new Set(),
  selectionSpaceId = null,
  transferTargets = [],
  viewMode = "list",
}: {
  detail: VaultDetail;
  disabled?: boolean;
  onAddSpace: () => void;
  allSpacesCollapsed?: boolean;
  onToggleAllSpaces?: () => void;
  onViewModeChange?: (mode: VaultViewMode) => void;
  onBatchTransfer?: (input: {
    action: "move" | "copy";
    targetVaultId: string;
    targetSpaceId: string;
  }) => Promise<void>;
  onCreateTransferTargetSpace?: (vaultId: string) => void;
  onLoadTransferTargets?: () => Promise<void>;
  selectedResourceIds?: Set<string>;
  selectionSpaceId?: string | null;
  transferTargets?: ResourceTransferTargetVault[];
  viewMode?: VaultViewMode;
}) {
  const [activeSpaceId, setActiveSpaceId] = useState(
    detail.spaces[0]?.id ?? "",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [batchTransferOpen, setBatchTransferOpen] = useState(false);
  const isOwner = detail.actorRole === "owner";
  const resourceCount = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const resource of detail.resources) {
      counts.set(resource.spaceId, (counts.get(resource.spaceId) ?? 0) + 1);
    }
    return counts;
  }, [detail.resources]);
  useEffect(() => {
    const nodes = detail.spaces
      .map((space) => document.getElementById(`space-${space.id}`))
      .filter((node): node is HTMLElement => node !== null);
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top,
          );
        const next = visible[0]?.target.id.replace(/^space-/, "");
        if (next) setActiveSpaceId(next);
      },
      { rootMargin: "-80px 0px -55% 0px", threshold: [0, 0.15, 0.5] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [detail.spaces]);

  function selectSpace(spaceId: string) {
    setActiveSpaceId(spaceId);
    document
      .getElementById(`space-${spaceId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const outline = (
    <OutlinePanel
      activeSpaceId={activeSpaceId}
      allSpacesCollapsed={allSpacesCollapsed}
      disabled={disabled}
      isOwner={isOwner}
      onAddSpace={onAddSpace}
      onOpenBatchTransfer={() => {
        setBatchTransferOpen(true);
        if (transferTargets.length === 0 && onLoadTransferTargets) {
          void onLoadTransferTargets();
        }
      }}
      onSelectSpace={selectSpace}
      onToggleCollapsed={onToggleAllSpaces ?? (() => undefined)}
      onViewModeChange={onViewModeChange ?? (() => undefined)}
      resourceCount={resourceCount}
      selectedResourceCount={selectedResourceIds.size}
      spaces={detail.spaces}
      viewMode={viewMode}
    />
  );

  return (
    <>
      <aside className="vault-detail-page__outline border border-border bg-card">
        {outline}
      </aside>
      <IconButton
        aria-label="Open space outline"
        className="fixed bottom-5 right-5 z-40 lg:hidden"
        icon={ListTree}
        onClick={() => setDrawerOpen(true)}
        size="md"
        title="Outline"
        variant="outline"
      />
      <Drawer
        onOpenChange={setDrawerOpen}
        open={drawerOpen}
        side="right"
        size={320}
      >
        <DrawerHeader>
          <DrawerTitle>Outline</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="p-0">{outline}</DrawerBody>
      </Drawer>
      {isOwner &&
      selectionSpaceId &&
      selectedResourceIds.size > 0 &&
      onBatchTransfer &&
      onCreateTransferTargetSpace &&
      onLoadTransferTargets ? (
        <ResourceTransferDialog
          disabled={disabled}
          focusedSpaceId={selectionSpaceId}
          onCreateSpace={onCreateTransferTargetSpace}
          onLoadTargets={onLoadTransferTargets}
          onOpenChange={setBatchTransferOpen}
          onTransfer={onBatchTransfer}
          open={batchTransferOpen}
          resourceTitle={`${selectedResourceIds.size} selected resources`}
          showTrigger={false}
          sourceSpaceId={selectionSpaceId}
          targets={transferTargets}
        />
      ) : null}
    </>
  );
}

function OutlinePanel({
  activeSpaceId,
  allSpacesCollapsed,
  disabled,
  isOwner,
  onAddSpace,
  onOpenBatchTransfer,
  onSelectSpace,
  onToggleCollapsed,
  onViewModeChange,
  resourceCount,
  selectedResourceCount,
  spaces,
  viewMode,
}: {
  activeSpaceId: string;
  allSpacesCollapsed: boolean;
  disabled: boolean;
  isOwner: boolean;
  onAddSpace: () => void;
  onOpenBatchTransfer: () => void;
  onSelectSpace: (spaceId: string) => void;
  onToggleCollapsed: () => void;
  onViewModeChange: (mode: VaultViewMode) => void;
  resourceCount: Map<string | null, number>;
  selectedResourceCount: number;
  spaces: VaultDetail["spaces"];
  viewMode: VaultViewMode;
}) {
  return (
    <div className="flex min-w-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="font-mono text-primary">▸</span>
        <span className="font-mono text-label uppercase tracking-[0.1em] text-muted-foreground">
          Outline
        </span>
        <span className="ml-auto font-mono text-label text-muted-foreground">
          {spaces.length} SPACES
        </span>
        <IconButton
          aria-label={allSpacesCollapsed ? "Expand all spaces" : "Collapse all spaces"}
          icon={allSpacesCollapsed ? ChevronDown : ChevronRight}
          onClick={onToggleCollapsed}
          size="sm"
          variant="ghost"
        />
      </div>
      <nav className="max-h-[44dvh] overflow-auto p-1.5">
          {spaces.length ? (
            <div className="flex flex-col gap-px">
              {spaces.map((space) => {
                const active = activeSpaceId === space.id;
                return (
                  <button
                    aria-current={active ? "location" : undefined}
                    className={
                      active
                        ? "flex w-full items-center gap-2 border border-transparent border-l-2 border-l-primary bg-accent px-2 py-[5px] text-left font-mono text-ui text-primary"
                        : "flex w-full items-center gap-2 border border-transparent border-l-2 px-2 py-[5px] text-left font-mono text-ui text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    }
                    key={space.id}
                    onClick={() => onSelectSpace(space.id)}
                    type="button"
                  >
                    <span className="w-[18px] shrink-0 text-label text-muted-foreground">
                      ├
                    </span>
                    <span className="grid size-4 shrink-0 place-items-center border border-border text-[9px] text-primary">
                      <SpaceIcon className="size-3.5" name={space.icon} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {space.name}
                    </span>
                    <span
                      className={
                        active
                          ? "shrink-0 text-label text-primary"
                          : "shrink-0 text-label text-muted-foreground"
                      }
                    >
                      {resourceCount.get(space.id) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-border px-3 py-4 text-center text-ui text-muted-foreground">
              No spaces yet
            </div>
          )}
      </nav>
      <div className="border-t border-border p-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex shrink-0 overflow-hidden border border-border">
            <IconButton
              aria-label="List view"
              className={
                viewMode === "list"
                  ? "border-0 bg-accent text-primary"
                  : "border-0"
              }
              icon={List}
              onClick={() => onViewModeChange("list")}
              size="sm"
              title="List view"
              variant="ghost"
            />
            <IconButton
              aria-label="Card view"
              className={
                viewMode === "masonry"
                  ? "border-0 bg-accent text-primary"
                  : "border-0 border-l border-border"
              }
              icon={LayoutGrid}
              onClick={() => onViewModeChange("masonry")}
              size="sm"
              title="Card view"
              variant="ghost"
            />
          </div>
          <span className="min-w-0 flex-1" />
          {isOwner && selectedResourceCount > 0 ? (
            <IconButton
              aria-label={`Move or copy ${selectedResourceCount} selected resources`}
              disabled={disabled}
              icon={FolderInput}
              onClick={onOpenBatchTransfer}
              size="sm"
              title="Move or copy selected resources"
              variant="ghost"
            />
          ) : null}
          {isOwner ? (
            <Button
              icon={Plus}
              onClick={onAddSpace}
              size="sm"
              type="button"
              variant="outline"
            >
              Space
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
