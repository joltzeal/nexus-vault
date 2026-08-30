"use client";

import { FolderInput, LoaderCircle, Search } from "lucide-react";
import { useState, type ComponentType } from "react";

import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ResourceTransferTargetVault } from "@/features/resource/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const Button = ButtonPrimitive as unknown as ComponentType<
  Record<string, unknown>
>;
const triggerClassName =
  "size-6 border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground [transform:none!important] [&_svg]:size-3.5 [&_svg]:scale-100 [&_svg]:transition-none";

export function SpaceTransferDialog({
  disabled,
  onLoadTargets,
  onMove,
  sourceVaultId,
  spaceName,
  targets,
}: {
  disabled: boolean;
  onLoadTargets: () => Promise<void>;
  onMove: (targetVaultId: string) => Promise<void>;
  sourceVaultId: string;
  spaceName: string;
  targets: ResourceTransferTargetVault[];
}) {
  const [open, setOpen] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [movingTargetId, setMovingTargetId] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const availableTargets = targets
    .filter((target) => target.id !== sourceVaultId)
    .filter((target) =>
      normalizedQuery
        ? target.title.toLocaleLowerCase().includes(normalizedQuery)
        : true,
    );

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      return;
    }
    if (targets.length > 0) return;

    setLoadingTargets(true);
    try {
      await onLoadTargets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load target vaults.",
      );
    } finally {
      setLoadingTargets(false);
    }
  }

  async function handleMove(targetVaultId: string) {
    if (movingTargetId) return;

    setMovingTargetId(targetVaultId);
    try {
      await onMove(targetVaultId);
      setOpen(false);
    } finally {
      setMovingTargetId("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => void handleOpenChange(value)}>
      <Button
        aria-label="Move space to another vault"
        className={triggerClassName}
        disabled={disabled}
        onClick={() => void handleOpenChange(true)}
        size="sm"
        title="Move space"
        type="button"
        variant="ghost"
      >
        <FolderInput />
        <span className="sr-only">Move space</span>
      </Button>
      <DialogContent className="max-h-[min(620px,calc(100dvh-2rem))] gap-0 overflow-hidden rounded-none border-border bg-card p-0 text-foreground sm:max-w-[460px]">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="font-display">Move space</DialogTitle>
          <DialogDescription className="truncate text-muted-foreground">
            {spaceName}
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoComplete="off"
              className="h-8 border-border bg-background pl-8 text-ui text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              disabled={loadingTargets}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter vaults"
              value={query}
            />
          </div>
        </div>
        <div className="max-h-[min(440px,calc(100dvh-15rem))] overflow-y-auto p-2">
          {loadingTargets ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              Loading vaults...
            </div>
          ) : availableTargets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {availableTargets.map((target) => {
                const moving = movingTargetId === target.id;

                return (
                  <button
                    className="flex min-h-11 w-full items-center gap-3 rounded-input px-3 py-2 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                    disabled={Boolean(movingTargetId)}
                    key={target.id}
                    onClick={() => void handleMove(target.id)}
                    type="button"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-input border border-border bg-background text-primary">
                      {moving ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <FolderInput className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {target.title}
                      </span>
                      <span className="mono block text-[10px] text-muted-foreground">
                        {target.spaces.length} spaces
                      </span>
                    </span>
                    <span className={cn("text-xs text-primary", moving && "animate-pulse")}>
                      {moving ? "Moving" : "Move"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-input border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
              {normalizedQuery ? "No matching vaults" : "No other owned vaults"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
