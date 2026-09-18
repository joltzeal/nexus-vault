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
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SearchField } from "@/components/aicanvas/andromeda/components/SearchField";
import { Spinner } from "@/components/aicanvas/andromeda/components/Spinner";
import { UserCard } from "@/components/aicanvas/andromeda/components/UserCard";
import { UserMenu } from "@/components/aicanvas/andromeda/components/UserMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { APP_VERSION } from "@/lib/app-version";

const emptyWorkspaceSearch: WorkspaceSearchResult = {
  vaults: [],
  spaces: [],
  resources: [],
};

type WorkspaceSearchSelection =
  | { type: "vault"; result: WorkspaceSearchResult["vaults"][number] }
  | { type: "space"; result: WorkspaceSearchResult["spaces"][number] }
  | { type: "resource"; result: WorkspaceSearchResult["resources"][number] };

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
  user,
  vaults = [],
}: DashboardSidebarProps) {
  const { state: sidebarState } = useAnimatedSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [vaultQuery, setVaultQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<WorkspaceSearchResult>(emptyWorkspaceSearch);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);
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
    return () => {
      searchControllerRef.current?.abort();
    };
  }, []);

  function runWorkspaceSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const query = vaultQuery.trim();
    if (!query) return;

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setSubmittedQuery(query);
    setSearchOpen(true);
    setSearching(true);
    setSearchError(null);

    void searchWorkspace(query, controller.signal)
      .then((results) => {
        if (!controller.signal.aborted) setSearchResults(results);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSearchResults(emptyWorkspaceSearch);
          setSearchError(
            error instanceof Error ? error.message : "Could not search workspace.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
  }

  function closeWorkspaceSearch() {
    setSearchOpen(false);
  }

  function handleSearchResultSelect(selection: WorkspaceSearchSelection) {
    const { result, type } = selection;
    if (type === "resource") {
      if (result.vaultId === "flash-stash") {
        navigate(`/dashboard/flash-stash#resource-${encodeURIComponent(result.id)}`);
      } else {
        onVaultLoadingChange?.(result.vaultId, true);
        navigate(
          `/dashboard/vault/${encodeURIComponent(result.vaultId)}#resource-${encodeURIComponent(result.id)}`,
        );
      }
      return;
    }
    handleVaultSelect(type === "vault" ? result.id : result.vaultId);
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
          onOpenHistory={onOpenHistory ?? (() => undefined)}
          onSignOut={onSignOut ?? (() => undefined)}
          user={user}
        />
      </AnimatedSidebarFooter>
      <AnimatedSidebarRail aria-label="Toggle navigation" />
      <WorkspaceSearchDrawer
        onClose={closeWorkspaceSearch}
        onQueryChange={setVaultQuery}
        onResultSelect={handleSearchResultSelect}
        onSearch={runWorkspaceSearch}
        open={searchOpen}
        query={vaultQuery}
        results={searchResults}
        searchedQuery={submittedQuery}
        searching={searching}
        error={searchError}
      />
    </AnimatedSidebar>
  );
}

function WorkspaceSearchDrawer({
  error,
  onClose,
  onQueryChange,
  onResultSelect,
  onSearch,
  open,
  query,
  results,
  searchedQuery,
  searching,
}: {
  error: string | null;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onResultSelect: (selection: WorkspaceSearchSelection) => void;
  onSearch: (event?: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  query: string;
  results: WorkspaceSearchResult;
  searchedQuery: string;
  searching: boolean;
}) {
  const resultCount =
    results.vaults.length + results.spaces.length + results.resources.length;

  return (
    <aside
      aria-hidden={!open}
      aria-label="Workspace search results"
      inert={!open}
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-[34rem] flex-col border-l border-border bg-card text-foreground shadow-2xl transition-transform duration-200 ease-out sm:w-[34rem] ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <header className="relative shrink-0 border-b border-border px-5 py-4 pr-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Search workspace
          </h2>
          <button
            aria-label="Close workspace search"
            className="absolute right-4 top-4 grid size-8 place-items-center text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-ui text-muted-foreground">
          Search resource titles, descriptions, URLs, vaults, and spaces.
        </p>
      </header>
      <form className="shrink-0 border-b border-border p-4" onSubmit={onSearch}>
        <SearchField
          ariaLabel="Search workspace"
          onValueChange={onQueryChange}
          placeholder="Type a query, then press Enter"
          shortcut={null}
          value={query}
        />
      </form>
      <ScrollArea className="min-h-0 flex-1 p-4">
        {searching ? (
          <p className="py-8 text-center text-ui text-muted-foreground">
            Searching workspace…
          </p>
        ) : null}
        {!searching && error ? (
          <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-ui text-destructive">
            {error}
          </p>
        ) : null}
        {!searching && !error && resultCount === 0 ? (
          <div className="py-12 text-center">
            <p className="text-ui font-medium text-foreground">
              No results for “{searchedQuery}”
            </p>
            <p className="mt-1 text-label text-muted-foreground">
              Try a title, a URL, a description, vault name, or space name.
            </p>
          </div>
        ) : null}
        {!searching && !error && resultCount > 0 ? (
          <div className="space-y-5">
              {results.vaults.length > 0 ? (
                <WorkspaceSearchSection label="Vaults">
                  {results.vaults.map((result) => (
                    <WorkspaceSearchResultRow
                      description={result.description}
                      key={`vault-${result.id}`}
                      matchedFields={result.matchedFields}
                      onSelect={() => onResultSelect({ result, type: "vault" })}
                      title={result.title}
                      type="Vault"
                    />
                  ))}
                </WorkspaceSearchSection>
              ) : null}
              {results.spaces.length > 0 ? (
                <WorkspaceSearchSection label="Spaces">
                  {results.spaces.map((result) => (
                    <WorkspaceSearchResultRow
                      description={result.description}
                      key={`space-${result.id}`}
                      location={result.vaultTitle}
                      matchedFields={result.matchedFields}
                      onSelect={() => onResultSelect({ result, type: "space" })}
                      title={result.name}
                      type="Space"
                    />
                  ))}
                </WorkspaceSearchSection>
              ) : null}
              {results.resources.length > 0 ? (
                <WorkspaceSearchSection label="Resources">
                  {results.resources.map((result) => (
                    <WorkspaceSearchResultRow
                      description={result.description}
                      key={`resource-${result.id}`}
                      location={result.spaceName ?? result.vaultTitle}
                      matchedFields={result.matchedFields}
                      onSelect={() => onResultSelect({ result, type: "resource" })}
                      title={result.title}
                      type="Resource"
                      url={result.url}
                    />
                  ))}
                </WorkspaceSearchSection>
              ) : null}
          </div>
        ) : null}
      </ScrollArea>
    </aside>
  );
}

function WorkspaceSearchSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-label font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </h3>
      <div className="overflow-hidden border border-border">{children}</div>
    </section>
  );
}

function WorkspaceSearchResultRow({
  description,
  location,
  matchedFields,
  onSelect,
  title,
  type,
  url,
}: {
  description: string;
  location?: string | null;
  matchedFields: string[];
  onSelect: () => void;
  title: string;
  type: "Vault" | "Space" | "Resource";
  url?: string | null;
}) {
  return (
    <button
      className="group block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-ui font-medium text-foreground group-hover:text-primary">
            {title}
          </p>
          {location ? (
            <p className="mt-0.5 break-words text-label text-muted-foreground">
              {location}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {type}
        </span>
      </div>
      {description ? (
        <p className="mt-2 line-clamp-2 break-words text-ui text-muted-foreground">
          {description}
        </p>
      ) : null}
      {url ? (
        <p className="mt-2 line-clamp-2 break-all font-mono text-label text-muted-foreground">
          {url}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {matchedFields.map((field) => (
          <span
            className="border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.04em] text-primary"
            key={field}
          >
            Matches {field}
          </span>
        ))}
      </div>
    </button>
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
