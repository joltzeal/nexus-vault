/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ChevronRight,
  FolderPlus,
  GitFork,
  Inbox,
  Pencil,
  Share2,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import { PanelMenu as PanelMenuPrimitive } from "@/components/aicanvas/andromeda/components/PanelMenu";
import { ButtonGroup } from "@/components/ui/button-group";
import type { VaultDetail } from "../api/vault-api";
import { Avatar } from "@/components/aicanvas/andromeda/components/Avatar";
import { Toggle } from "@/components/aicanvas/andromeda/components/Toggle";

const Button: any = ButtonPrimitive;
const PanelMenu: any = PanelMenuPrimitive;

export type VaultHeaderProps = {
  detail?: VaultDetail;
  disabled?: boolean;
  isShareMode?: boolean;
  mediaVisible?: boolean;
  pendingSubmissionCount?: number;
  onAddResource?: () => void;
  onCreateSpace?: () => void;
  onDeleteVault?: () => void;
  onEditVault?: () => void;
  onForkVault?: () => void;
  onOpenSettings?: (tab: "share" | "members" | "submissions") => void;
  onToggleMediaVisibility?: (visible: boolean) => void;
  onToggleStar?: () => void;
};

export function VaultHeader({
  detail,
  disabled = false,
  isShareMode = false,
  mediaVisible = true,
  pendingSubmissionCount = 0,
  onAddResource,
  onCreateSpace,
  onDeleteVault,
  onEditVault,
  onForkVault,
  onOpenSettings,
  onToggleMediaVisibility,
  onToggleStar,
}: VaultHeaderProps) {
  const navigate = useNavigate();
  const vault = detail?.vault;
  const owner = detail?.actorRole === "owner";
  const canAddResource =
    detail?.actorRole === "owner" || detail?.actorRole === "editor";
  const stats = [
    ["spaces", detail?.spaces.length ?? 0],
    ["resources", detail?.resources.length ?? 0],
    ["stars", vault?.starCount ?? 0],
    ["forks", vault?.forkCount ?? 0],
  ] as const;
  const menuItems = [
    ...(owner
      ? [
          { label: "Add space", icon: FolderPlus, onSelect: onCreateSpace },
          { label: "Edit vault", icon: Pencil, onSelect: onEditVault },
          {
            label: "Delete vault",
            icon: Trash2,
            destructive: true,
            onSelect: onDeleteVault,
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="mb-2 flex items-center px-1 font-mono text-ui text-muted-foreground">
        <button
          className="transition hover:text-foreground"
          onClick={() => navigate("/dashboard")}
          type="button"
        >
          ~/vaults
        </button>
        <span aria-hidden="true" className="px-1 text-muted-foreground">
          /
        </span>
        <span className="min-w-0 truncate text-primary">
          {vault?.title ?? "new-vault"}
        </span>
      </div>
      <section className="overflow-hidden border border-border bg-card">
        <div className="border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 font-mono text-ui">
                {vault?.cover ? (
                  <Avatar
                    className="size-7 text-base"
                    name={vault.cover}
                    size="md"
                    src={vault.cover.startsWith("http://") || vault.cover.startsWith("https://") ? vault.cover : undefined}
                    status="online"
                  />
                ) : null}
                <span className="font-semibold text-primary">$</span>
                <span className="shrink-0 text-muted-foreground">
                  vault open
                </span>
                <h1 className="min-w-0 truncate font-mono text-ui font-semibold text-foreground">
                  {vault?.title ?? "new-vault"}
                </h1>
                <span className="shrink-0 text-primary">
                  --{vault?.visibility ?? "private"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {isShareMode && onToggleMediaVisibility ? (
                <Toggle
                  checked={mediaVisible}
                  label="NSFW media"
                  onCheckedChange={onToggleMediaVisibility}
                />
              ) : null}
              {canAddResource ? (
                <Button
                  disabled={disabled || !vault}
                  icon={UserPlus}
                  onClick={onAddResource}
                  size="sm"
                  variant="default"
                >
                  Add resource
                </Button>
              ) : null}
              {owner ? (
                <ButtonGroup aria-label="Vault collaboration settings">
                  <Button
                    data-slot="button"
                    disabled={disabled || !vault}
                    icon={Share2}
                    onClick={() => onOpenSettings?.("share")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Share
                  </Button>
                  <Button
                    data-slot="button"
                    disabled={disabled || !vault}
                    icon={Users}
                    onClick={() => onOpenSettings?.("members")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Members
                  </Button>
                  <Button
                    data-slot="button"
                    disabled={disabled || !vault}
                    icon={Inbox}
                    onClick={() => onOpenSettings?.("submissions")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Submissions
                    {pendingSubmissionCount > 0
                      ? ` ${pendingSubmissionCount}`
                      : ""}
                  </Button>
                </ButtonGroup>
              ) : null}
              {!owner && detail ? (
                <>
                  <Button
                    disabled={disabled || !vault}
                    icon={Star}
                    onClick={onToggleStar}
                    size="sm"
                    variant="outline"
                  >
                    Star {vault?.starCount ?? 0}
                  </Button>
                  <Button
                    disabled={disabled || !vault}
                    icon={GitFork}
                    onClick={onForkVault}
                    size="sm"
                    variant="outline"
                  >
                    Fork {vault?.forkCount ?? 0}
                  </Button>
                </>
              ) : null}
              {!isShareMode ? <div className="flex items-center gap-0.5">
                <PanelMenu
                  align="right"
                  ariaLabel="More vault actions"
                  items={menuItems}
                />
              </div> : null}
            </div>
          </div>
          {vault?.description?.trim() ? (
            <div className="mt-3 flex min-w-0 items-start gap-2 text-ui text-muted-foreground">
              <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="min-w-0 whitespace-pre-wrap break-words">{vault.description.trim()}</p>
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 font-mono text-label text-muted-foreground sm:px-4">
          <span className="shrink-0">
            owner{" "}
            <strong className="font-medium text-foreground">
              @{vault?.ownerName || "unknown"}
            </strong>
          </span>
          {stats.map(([label, value]) => (
            <span
              className="shrink-0 before:mr-3 before:text-muted-foreground before:content-['·']"
              key={label}
            >
              {label}{" "}
              <strong className="font-medium text-foreground">{value}</strong>
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
