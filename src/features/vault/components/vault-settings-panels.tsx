"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, Inbox, Trash2, Upload, X } from "lucide-react";
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
import { Button } from "@/components/aicanvas/andromeda/components/Button";
import { Badge } from "@/components/aicanvas/andromeda/components/Badge";
import {
  Card,
  CardContent,
} from "@/components/aicanvas/andromeda/components/Card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/aicanvas/andromeda/components/EmptyState";
import { Input } from "@/components/aicanvas/andromeda/components/Input";
import {
  Radio,
  RadioGroup,
} from "@/components/aicanvas/andromeda/components/Radio";
import { Toggle } from "@/components/aicanvas/andromeda/components/Toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResourceMediaGallery } from "@/features/resource/resource-media-gallery";
import type {
  ResourceSubmissionItem,
  Visibility,
} from "@/features/resource/types";
import type {
  VaultCollaborator,
  VaultExport,
  VaultShare,
} from "../api/vault-settings-api";

export function SharePanel({
  share,
  password,
  isBusy,
  isImporting,
  nsfwEnabled,
  canDeleteVault,
  onPasswordChange,
  onVisibilityChange,
  onSubmit,
  onNsfwChange,
  onExport,
  onImport,
  onDelete,
}: {
  share: VaultShare;
  password: string;
  isBusy: boolean;
  isImporting: boolean;
  nsfwEnabled: boolean;
  canDeleteVault: boolean;
  onPasswordChange: (value: string) => void;
  onVisibilityChange: (value: Visibility) => void;
  onSubmit: () => void;
  onNsfwChange: (value: boolean) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shareUrl =
    share.slug && typeof window !== "undefined"
      ? `${window.location.origin}/s/${share.slug}`
      : "";

  async function copyUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase text-muted-foreground">
          Visibility
        </span>
        <RadioGroup
          value={share.visibility}
          onValueChange={(value) => onVisibilityChange(value as Visibility)}
        >
          {(["public", "password", "private"] as Visibility[]).map((value) => (
            <label
              className="flex cursor-pointer items-center gap-3 border border-border bg-card p-3"
              key={value}
            >
              <Radio value={value} />
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-foreground">
                  {visibilityLabel(value)}
                </strong>
                <span className="block text-xs text-muted-foreground">
                  {visibilityDescription(value)}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {share.visibility === "password" ? (
        <Input
          label="Access password"
          autoComplete="new-password"
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      ) : null}
      {share.visibility !== "private" ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-label uppercase text-muted-foreground">
            Share link
          </span>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {shareUrl || "Save settings to generate a link"}
            </div>
            <Button
              aria-label="Copy share link"
              disabled={!shareUrl}
              icon={copied ? Check : Copy}
              onClick={() => void copyUrl()}
              size="sm"
              type="button"
              variant="outline"
            />
          </div>
        </div>
      ) : null}
      <Button
        disabled={
          isBusy || (share.visibility === "password" && !password.trim())
        }
        onClick={onSubmit}
      >
        Save share settings
      </Button>
      <Card bordered>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">NSFW mode</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Hide media by default for visitors.
            </p>
          </div>
          <Toggle
            checked={nsfwEnabled}
            disabled={isBusy}
            onCheckedChange={onNsfwChange}
          />
        </CardContent>
      </Card>
      <Card bordered>
        <CardContent className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Import / export
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Export spaces, resources and metadata as JSON.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={isBusy}
              icon={Download}
              onClick={onExport}
              size="sm"
              type="button"
              variant="outline"
            >
              Export
            </Button>
            <Button
              disabled={isBusy || isImporting}
              icon={isImporting ? undefined : Upload}
              onClick={() => fileRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </div>
          <input
            ref={fileRef}
            accept="application/json,.json"
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }}
          />
        </CardContent>
      </Card>
      {canDeleteVault ? (
        <Card bordered className="border-destructive/50">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 shrink-0 text-destructive" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">
                  Delete vault
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  This archives the vault and removes it from your list.
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    disabled={isBusy}
                    icon={Trash2}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Delete vault
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this vault?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action archives the vault and disables its share link.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} variant="destructive">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function MembersPanel({
  ownerName,
  items,
  isBusy,
  onRemove,
}: {
  ownerName: string;
  items: VaultCollaborator[];
  isBusy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase text-muted-foreground">
          Owner
        </span>
        <Card bordered>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-8 place-items-center border border-primary bg-primary/10 text-xs font-semibold text-primary">
              {initials(ownerName)}
            </div>
            <strong className="min-w-0 flex-1 truncate text-sm text-foreground">
              {ownerName || "Owner"}
            </strong>
            <Badge variant="accent">Owner</Badge>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase text-muted-foreground">
          Editors · {items.length}
        </span>
        {items.length === 0 ? (
          <EmptyState>
            <EmptyStateTitle>No editors</EmptyStateTitle>
            <EmptyStateDescription>
              Add collaborators to let them edit this vault.
            </EmptyStateDescription>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <Card bordered key={item.id}>
                <CardContent className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center border border-border bg-muted text-xs font-semibold text-foreground">
                    {initials(item.name || item.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-foreground">
                      {item.name || item.email}
                    </strong>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.email}
                    </span>
                  </div>
                  <Badge variant="subtle">Editor</Badge>
                  <Button
                    aria-label={`Remove ${item.email}`}
                    disabled={isBusy}
                    icon={Trash2}
                    onClick={() => onRemove(item.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SubmissionsPanel({
  items,
  spaces,
  collectionEnabled,
  isBusy,
  onCollectionChange,
  onApprove,
  onReject,
}: {
  items: ResourceSubmissionItem[];
  spaces: Array<{ id: string; name: string }>;
  collectionEnabled: boolean;
  isBusy: boolean;
  onCollectionChange: (value: boolean) => void;
  onApprove: (id: string, spaceId?: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card bordered>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Public collection
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Allow visitors to submit resources for review.
            </p>
          </div>
          <Toggle
            checked={collectionEnabled}
            disabled={isBusy}
            onCheckedChange={onCollectionChange}
          />
        </CardContent>
      </Card>
      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateTitle>No pending submissions</EmptyStateTitle>
          <EmptyStateDescription>
            New visitor submissions will appear here.
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        items.map((item) => (
          <SubmissionCard
            item={item}
            isBusy={isBusy}
            key={item.id}
            onApprove={onApprove}
            onReject={onReject}
            spaces={spaces}
          />
        ))
      )}
    </div>
  );
}

function SubmissionCard({
  item,
  spaces,
  isBusy,
  onApprove,
  onReject,
}: {
  item: ResourceSubmissionItem;
  spaces: Array<{ id: string; name: string }>;
  isBusy: boolean;
  onApprove: (id: string, spaceId?: string) => void;
  onReject: (id: string) => void;
}) {
  const [spaceId, setSpaceId] = useState(item.spaceId ?? "");
  const media = submissionMedia(item.metadataJson);
  return (
    <Card bordered>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Inbox className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-sm font-semibold text-foreground">
              {item.title || item.url}
            </h3>
            <a
              className="block truncate text-xs text-primary hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              {item.url}
            </a>
            {item.description ? (
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
          <Badge variant="outline">{item.type}</Badge>
        </div>
        {media.length > 0 ? (
          <ResourceMediaGallery media={media} title={item.title || item.url} />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {item.submitterName || item.submitterEmail || "Anonymous"}
          </span>
          <span>{new Date(item.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {spaces.length > 0 ? (
            <Select
              value={spaceId}
              onValueChange={(value) => setSpaceId(value ?? "")}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Target space" />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            disabled={isBusy}
            icon={X}
            onClick={() => onReject(item.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            Reject
          </Button>
          <Button
            disabled={isBusy}
            icon={Check}
            onClick={() =>
              onApprove(item.id, spaceId || item.spaceId || undefined)
            }
            size="sm"
            type="button"
          >
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function visibilityLabel(value: Visibility) {
  return value === "public"
    ? "Public"
    : value === "password"
      ? "Password protected"
      : "Private";
}
function visibilityDescription(value: Visibility) {
  return value === "public"
    ? "Anyone with the link can view."
    : value === "password"
      ? "Visitors must enter a password."
      : "Only vault members can view.";
}
function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function submissionMedia(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const media = (value as { media?: unknown }).media;
  if (!Array.isArray(media)) return [];
  return media.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const src =
      typeof item.url === "string"
        ? item.url
        : typeof item.src === "string"
          ? item.src
          : "";
    if (!src) return [];
    const kind: "image" | "video" = item.kind === "video" ? "video" : "image";
    return [{ kind, src, alt: typeof item.alt === "string" ? item.alt : "" }];
  });
}

export type { VaultExport };
