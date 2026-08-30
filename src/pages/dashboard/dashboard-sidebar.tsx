import { EyeSlash, Gear, SignOut } from "@phosphor-icons/react";
import {
  Clock3,
  Folder,
  PanelLeftClose,
  Plus,
  Share2,
  Star,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SearchField } from "@/components/aicanvas/andromeda/components/SearchField";
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

export type DashboardSidebarUser = {
  email: string;
  image?: string | null;
  name: string;
};
type DashboardSidebarProps = {
  disabled?: boolean;
  mediaVisible?: boolean;
  onCreateVault?: () => void;
  onMediaVisibleChange?: (visible: boolean) => void;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
  user?: DashboardSidebarUser;
  vaults?: DashboardVaultItem[];
};

export function DashboardSidebar({
  disabled = false,
  mediaVisible = true,
  onCreateVault,
  onMediaVisibleChange,
  onOpenSettings,
  onSignOut,
  user,
  vaults = [],
}: DashboardSidebarProps) {
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
            : "vault-document";
  const itemClass = (active: boolean) =>
    active
      ? "dashboard-sidebar-item dashboard-sidebar-item--active"
      : "dashboard-sidebar-item";
  const filteredVaults = vaults.filter((vault) =>
    vault.title
      .toLocaleLowerCase()
      .includes(vaultQuery.trim().toLocaleLowerCase()),
  );
  return (
    <AnimatedSidebar
      ariaLabel="NexusVault navigation"
      className="!h-full"
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
              <span aria-hidden="true" className="sidebar-cursor text-primary" />
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
            placeholder="Search vaults"
            shortcut={null}
            value={vaultQuery}
          />
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
              {filteredVaults.map((vault) => (
                <AnimatedSidebarMenuItem key={vault.id}>
                  <AnimatedSidebarMenuButton
                    badge={vault.resourceCount}
                    className={itemClass(
                      activePage === "vault-document" &&
                        activeVaultId === vault.id,
                    )}
                    icon={
                      vault.cover?.startsWith("http://") || vault.cover?.startsWith("https://") ? (
                        <img
                          alt=""
                          className="size-4 rounded-sm object-cover"
                          src={vault.cover}
                        />
                      ) : vault.cover ? (
                        <span aria-hidden="true" className="text-sm leading-none">
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
                    onSelect={() =>
                      navigate(
                        `/dashboard/vault/${encodeURIComponent(vault.id)}`,
                      )
                    }
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
        <AnimatedSidebarMenu className="border-sidebar-border border-b pb-2">
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              className="h-8 min-h-0 gap-2 px-2 text-ui font-normal"
              disabled={disabled}
              icon={<Plus className="size-4" />}
              onSelect={onCreateVault}
            >
              New vault
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
        </AnimatedSidebarMenu>
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
