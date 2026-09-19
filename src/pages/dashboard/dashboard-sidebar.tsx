import { ClockCounterClockwise, EyeSlash, Gear, SignOut } from "@phosphor-icons/react";
import {
  Clock3,
  Folder,
  PanelLeftClose,
  FilePlus2,
  FolderPlus,
  Inbox,
  Share2,
  Star,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SearchField } from "@/components/aicanvas/andromeda/components/SearchField";
import { Spinner } from "@/components/aicanvas/andromeda/components/Spinner";
import { UserCard } from "@/components/aicanvas/andromeda/components/UserCard";
import { UserMenu } from "@/components/aicanvas/andromeda/components/UserMenu";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from "@/components/motion/animated-sidebar";
import { Toggle } from "@/components/aicanvas/andromeda/components/Toggle";
import type { DashboardVaultItem } from "@/features/dashboard/types";
import { BloomMenu } from "@/components/motion/bloom-menu";
import { APP_VERSION } from "@/lib/app-version";

export type DashboardSidebarUser = {
  email: string;
  image?: string | null;
  name: string;
};
type DashboardSidebarProps = {
  disabled?: boolean;
  loadingVaultId?: string | null;
  mediaVisible?: boolean;
  onVaultLoadingChange?: (vaultId: string, loading: boolean) => void;
  onCreateVault?: () => void;
  onCreateResource?: () => void;
  onMediaVisibleChange?: (visible: boolean) => void;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onSignOut?: () => void;
  workspaceSearchActive?: boolean;
  onWorkspaceSearch?: (query: string) => void;
  user?: DashboardSidebarUser;
  vaults?: DashboardVaultItem[];
};

export function DashboardSidebar({
  disabled = false,
  loadingVaultId = null,
  mediaVisible = true,
  onVaultLoadingChange,
  onCreateVault,
  onCreateResource,
  onMediaVisibleChange,
  onOpenSettings,
  onOpenHistory,
  onSignOut,
  workspaceSearchActive = false,
  onWorkspaceSearch,
  user,
  vaults = [],
}: DashboardSidebarProps) {
  const { state: sidebarState } = useAnimatedSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [vaultQuery, setVaultQuery] = useState("");
  const activeVaultId = location.pathname.match(
    /^\/dashboard\/vault\/([^/]+)/,
  )?.[1];
  const activePage =
    location.pathname === "/dashboard"
      ? "all-vaults"
      : location.pathname === "/dashboard/starred"
        ? "starred-vaults"
        : location.pathname === "/dashboard/watch-later"
          ? "watch-later"
          : location.pathname === "/dashboard/shared"
            ? "shared-vaults"
            : location.pathname === "/dashboard/flash-stash"
              ? "flash-stash"
              : "vault-document";
  const itemClass = (active: boolean) =>
    active
      ? "dashboard-sidebar-item dashboard-sidebar-item--active"
      : "dashboard-sidebar-item";
  const isActivePage = (page: typeof activePage) =>
    !workspaceSearchActive && activePage === page;
  function handleVaultSelect(vaultId: string) {
    if (activeVaultId === vaultId) return;
    onVaultLoadingChange?.(vaultId, true);
    navigate(`/dashboard/vault/${encodeURIComponent(vaultId)}`);
  }

  function runWorkspaceSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = vaultQuery.trim();
    if (!query) return;
    onWorkspaceSearch?.(query);
  }
  return (
    <AnimatedSidebar
      ariaLabel="NexusVault navigation"
      className="!h-full z-30"
      collapsible="icon"
      panelClassName="!h-full border-sidebar-border bg-sidebar"
    >
      <AnimatedSidebarHeader className="border-sidebar-border border-b px-3 py-3">
        <div className="flex h-8 items-center gap-2 overflow-hidden group-data-[state=collapsed]/sidebar:justify-center">
          <AnimatedSidebarTrigger
            aria-label="Expand navigation"
            className="hidden size-8 items-center justify-center group-data-[state=collapsed]/sidebar:inline-flex"
            title="Expand navigation"
          >
            <span className="grid size-6 place-items-center border border-line-soft bg-ink-900 p-1">
              <img alt="" className="size-full" src="/icon.svg" />
            </span>
          </AnimatedSidebarTrigger>
          <div className="flex min-w-0 items-center gap-2 group-data-[state=collapsed]/sidebar:hidden">
            <span className="grid size-7 shrink-0 place-items-center border border-line-soft bg-ink-900 p-1">
              <img alt="" className="size-full" src="/icon.svg" />
            </span>
            <div className="flex min-w-0 items-end gap-3">
              <span className="min-w-0 font-mono text-xs font-semibold leading-none tracking-[0.1em] text-foreground">
                <span className="text-primary">NEXUS</span>
                <span className="px-1 text-fg-dim">/</span>
                <span className="text-fg">VAULT</span>
              </span>
              <span className="mono shrink-0 text-[9px] leading-none tracking-[0.08em] text-fg-dim">
                v{APP_VERSION}
              </span>
              <span
                aria-hidden="true"
                className="sidebar-cursor text-primary"
              />
            </div>
          </div>
          <AnimatedSidebarClose
            aria-label="Close navigation"
            className="ml-auto size-8 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <PanelLeftClose className="size-4" />
          </AnimatedSidebarClose>
        </div>
      </AnimatedSidebarHeader>
      <AnimatedSidebarContent className="overflow-hidden px-2 py-2">
        <div className="px-1  group-data-[state=collapsed]/sidebar:hidden">
          <form onSubmit={runWorkspaceSearch}>
            <SearchField
              ariaLabel="Search workspace"
              onValueChange={setVaultQuery}
              placeholder="Search workspace · Enter"
              shortcut={null}
              value={vaultQuery}
            />
          </form>
        </div>
        <AnimatedSidebarGroup className="px-1 py-0">
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={vaults.length}
                  className={itemClass(isActivePage("all-vaults"))}
                  icon={<Folder className="size-4" />}
                  isActive={isActivePage("all-vaults")}
                  onSelect={() => navigate("/dashboard")}
                >
                  All vaults
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(isActivePage("flash-stash"))}
                  icon={<Inbox className="size-4" />}
                  isActive={isActivePage("flash-stash")}
                  onSelect={() => navigate("/dashboard/flash-stash")}
                >
                  Flash stash
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(isActivePage("starred-vaults"))}
                  disabled={disabled}
                  icon={<Star className="size-4" />}
                  isActive={isActivePage("starred-vaults")}
                  onSelect={() => navigate("/dashboard/starred")}
                >
                  Starred
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(isActivePage("watch-later"))}
                  icon={<Clock3 className="size-4" />}
                  isActive={isActivePage("watch-later")}
                  onSelect={() => navigate("/dashboard/watch-later")}
                >
                  Watch later
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(isActivePage("shared-vaults"))}
                  icon={<Share2 className="size-4" />}
                  isActive={isActivePage("shared-vaults")}
                  onSelect={() => navigate("/dashboard/shared")}
                >
                  Shared with me
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
        <AnimatedSidebarGroup className="mt-3 min-h-0 flex-1 px-1 py-0">
          <AnimatedSidebarGroupLabel className="h-6 px-2 text-label">
            Vaults
          </AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AnimatedSidebarMenu className="pb-1">
              {vaults.map((vault) => (
                <AnimatedSidebarMenuItem key={vault.id}>
                  <AnimatedSidebarMenuButton
                    badge={vault.resourceCount}
                    className={itemClass(
                      !workspaceSearchActive &&
                        activePage === "vault-document" &&
                        activeVaultId === vault.id,
                    )}
                    disabled={disabled || loadingVaultId === vault.id}
                    icon={
                      loadingVaultId === vault.id ? (
                        <Spinner
                          variant="accent"
                          size="sm"
                          label="Loading vault"
                        />
                      ) : vault.cover?.startsWith("http://") ||
                        vault.cover?.startsWith("https://") ? (
                        <img
                          alt=""
                          className="size-4 object-cover"
                          src={vault.cover}
                        />
                      ) : vault.cover ? (
                        <span
                          aria-hidden="true"
                          className="text-sm leading-none"
                          style={{
                            fontFamily:
                              "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
                          }}
                        >
                          {vault.cover}
                        </span>
                      ) : (
                        <Folder className="size-4" />
                      )
                    }
                    isActive={
                      !workspaceSearchActive &&
                      activePage === "vault-document" &&
                      activeVaultId === vault.id
                    }
                    onSelect={() => handleVaultSelect(vault.id)}
                    tooltip={vault.title}
                  >
                    {vault.title}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
      </AnimatedSidebarContent>
      <AnimatedSidebarFooter className="border-sidebar-border p-2">
        <div className="border-sidebar-border border-b pb-2">
          <BloomMenu
            className="justify-start"
            compact={sidebarState === "collapsed"}
            disabled={disabled}
            items={[
              { label: "Create vault", icon: FolderPlus },
              { label: "Add resource", icon: FilePlus2 },
            ]}
            onSelect={(label) => {
              if (label === "Create vault") onCreateVault?.();
              if (label === "Add resource") onCreateResource?.();
            }}
          />
        </div>
        <DashboardAccountFooter
          displayEmail={user?.email ?? "Please sign in"}
          displayName={user?.name ?? "Guest"}
          mediaVisible={mediaVisible}
          onMediaVisibleChange={onMediaVisibleChange ?? (() => undefined)}
          onOpenSettings={onOpenSettings ?? (() => undefined)}
          onOpenHistory={onOpenHistory ?? (() => undefined)}
          onSignOut={onSignOut ?? (() => undefined)}
          user={user}
        />
      </AnimatedSidebarFooter>
      <AnimatedSidebarRail aria-label="Toggle navigation" />
    </AnimatedSidebar>
  );
}

function DashboardAccountFooter({
  displayEmail,
  displayName,
  mediaVisible,
  onMediaVisibleChange,
  onOpenSettings,
  onOpenHistory,
  onSignOut,
  user,
}: {
  displayEmail: string;
  displayName: string;
  mediaVisible: boolean;
  onMediaVisibleChange: (visible: boolean) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onSignOut: () => void;
  user?: DashboardSidebarUser;
}) {
  const { isMobile, state } = useAnimatedSidebar();
  const items = [
    { id: "settings", label: "Settings", icon: Gear, onSelect: onOpenSettings },
    { id: "history", label: "History", icon: ClockCounterClockwise, onSelect: onOpenHistory },
    { id: "separator", type: "separator" as const },
    {
      id: "nsfw",
      label: "NSFW",
      icon: EyeSlash,
      closeOnSelect: false,
      trailing: (
        <Toggle
          checked={!mediaVisible}
          onCheckedChange={(checked: boolean) => onMediaVisibleChange(!checked)}
          size="sm"
        />
      ),
    },
    {
      id: "sign-out",
      label: "Log out",
      icon: SignOut,
      destructive: true,
      disabled: !user,
      onSelect: onSignOut,
    },
  ];
  const name = displayName.trim() || "Guest";
  const role = displayEmail.trim() || "Please sign in";
  return state === "collapsed" && !isMobile ? (
    <UserMenu
      align="start"
      ariaLabel="Account"
      avatarSize="sm"
      className="w-full justify-center"
      items={items}
      name={name}
      placement="top"
      portal
      showCaret={false}
      src={user?.image ?? undefined}
      status="online"
      style={{ width: "100%", justifyContent: "center" }}
      surface="var(--ink-800)"
    />
  ) : (
    <UserCard
      align="start"
      ariaLabel="Account"
      avatarSize="sm"
      items={items}
      name={name}
      placement="top"
      role={role}
      src={user?.image ?? undefined}
      status="online"
      surface="var(--ink-800)"
    />
  );
}
