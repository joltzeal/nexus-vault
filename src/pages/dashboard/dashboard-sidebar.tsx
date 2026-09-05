import { EyeSlash, Gear, SignOut } from "@phosphor-icons/react";
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
import { useEffect, useState } from "react";
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
import {
  searchWorkspace,
  type WorkspaceSearchResult,
} from "@/features/dashboard/search-api";
import { BloomMenu } from "@/components/motion/bloom-menu";

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
  onSignOut?: () => void;
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
  onSignOut,
  user,
  vaults = [],
}: DashboardSidebarProps) {
  const { state: sidebarState } = useAnimatedSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [vaultQuery, setVaultQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult>({
    vaults: [],
    spaces: [],
    resources: [],
  });
  const [searching, setSearching] = useState(false);
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
  function handleVaultSelect(vaultId: string) {
    if (activeVaultId === vaultId) return;
    onVaultLoadingChange?.(vaultId, true);
    navigate(`/dashboard/vault/${encodeURIComponent(vaultId)}`);
  }
  useEffect(() => {
    const query = vaultQuery.trim();
    if (!query) {
      setSearchResults({ vaults: [], spaces: [], resources: [] });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchWorkspace(query, controller.signal)
        .then(setSearchResults)
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [vaultQuery]);
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
                v0.0.0
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
      <AnimatedSidebarContent className="px-2 py-2">
        <div className="px-1  group-data-[state=collapsed]/sidebar:hidden">
          <SearchField
            ariaLabel="Search vaults"
            onValueChange={setVaultQuery}
            placeholder="Search workspace"
            shortcut={null}
            value={vaultQuery}
          />
          {vaultQuery.trim() ? (
            <div className="mt-2 max-h-64 overflow-y-auto border border-border bg-sidebar p-1">
              {searching ? (
                <p className="px-2 py-2 text-label text-muted-foreground">
                  Searching...
                </p>
              ) : null}
              {!searching &&
              searchResults.vaults.length === 0 &&
              searchResults.spaces.length === 0 &&
              searchResults.resources.length === 0 ? (
                <p className="px-2 py-2 text-label text-muted-foreground">
                  No matches
                </p>
              ) : null}
              {searchResults.vaults.map((result) => (
                <button
                  className="flex w-full items-center px-2 py-1.5 text-left text-ui text-foreground hover:bg-accent"
                  key={`vault-${result.id}`}
                  onClick={() => handleVaultSelect(result.id)}
                  type="button"
                >
                  <span className="truncate">{result.title}</span>
                  <span className="ml-auto text-label text-muted-foreground">
                    Vault
                  </span>
                </button>
              ))}
              {searchResults.spaces.map((result) => (
                <button
                  className="flex w-full items-center px-2 py-1.5 text-left text-ui text-foreground hover:bg-accent"
                  key={`space-${result.id}`}
                  onClick={() => handleVaultSelect(result.vaultId)}
                  type="button"
                >
                  <span className="truncate">{result.name}</span>
                  <span className="ml-auto truncate pl-2 text-label text-muted-foreground">
                    {result.vaultTitle}
                  </span>
                </button>
              ))}
              {searchResults.resources.map((result) => (
                <button
                  className="flex w-full items-center px-2 py-1.5 text-left text-ui text-foreground hover:bg-accent"
                  key={`resource-${result.id}`}
                  onClick={() =>
                    result.vaultId === "flash-stash"
                      ? navigate("/dashboard/flash-stash")
                      : handleVaultSelect(result.vaultId)
                  }
                  type="button"
                >
                  <span className="min-w-0 truncate">{result.title}</span>
                  <span className="ml-auto truncate pl-2 text-label text-muted-foreground">
                    {result.spaceName ?? result.vaultTitle}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <AnimatedSidebarGroup className="px-1 py-0">
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={vaults.length}
                  className={itemClass(activePage === "all-vaults")}
                  icon={<Folder className="size-4" />}
                  isActive={activePage === "all-vaults"}
                  onSelect={() => navigate("/dashboard")}
                >
                  All vaults
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(activePage === "flash-stash")}
                  icon={<Inbox className="size-4" />}
                  isActive={activePage === "flash-stash"}
                  onSelect={() => navigate("/dashboard/flash-stash")}
                >
                  Flash stash
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(activePage === "starred-vaults")}
                  disabled={disabled}
                  icon={<Star className="size-4" />}
                  isActive={activePage === "starred-vaults"}
                  onSelect={() => navigate("/dashboard/starred")}
                >
                  Starred
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(activePage === "watch-later")}
                  icon={<Clock3 className="size-4" />}
                  isActive={activePage === "watch-later"}
                  onSelect={() => navigate("/dashboard/watch-later")}
                >
                  Watch later
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton
                  badge={0}
                  className={itemClass(activePage === "shared-vaults")}
                  icon={<Share2 className="size-4" />}
                  isActive={activePage === "shared-vaults"}
                  onSelect={() => navigate("/dashboard/shared")}
                >
                  Shared with me
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
        <AnimatedSidebarGroup className="mt-3 px-1 py-0">
          <AnimatedSidebarGroupLabel className="h-6 px-2 text-label">
            Vaults
          </AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              {vaults.map((vault) => (
                <AnimatedSidebarMenuItem key={vault.id}>
                  <AnimatedSidebarMenuButton
                    badge={vault.resourceCount}
                    className={itemClass(
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
  onSignOut,
  user,
}: {
  displayEmail: string;
  displayName: string;
  mediaVisible: boolean;
  onMediaVisibleChange: (visible: boolean) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  user?: DashboardSidebarUser;
}) {
  const { isMobile, state } = useAnimatedSidebar();
  const items = [
    { id: "settings", label: "Settings", icon: Gear, onSelect: onOpenSettings },
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
