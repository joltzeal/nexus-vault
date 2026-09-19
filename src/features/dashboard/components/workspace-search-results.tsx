import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SearchField } from "@/components/aicanvas/andromeda/components/SearchField";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ResourceCard } from "@/features/resource/components";
import {
  setResourceReadLater,
  setResourceStarred,
  updateResourceAnnotation,
} from "@/features/resource/api";
import type { Resource, ResourceAnnotationPatch } from "@/features/resource/types";
import type { VaultResourceViewMode } from "@/features/resource/vault-view-mode";
import {
  searchWorkspace,
  type WorkspaceSearchResult,
} from "@/features/dashboard/search-api";
import { useDocumentTitle } from "@/hooks/use-document-title";

const emptySearchResult: WorkspaceSearchResult = {
  resources: [],
};

export function WorkspaceSearchResults({
  mediaVisible,
  onClose,
  onSearch,
  query,
  requestId,
  viewMode,
}: {
  mediaVisible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  query: string;
  requestId: number;
  viewMode: VaultResourceViewMode;
}) {
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] =
    useState<WorkspaceSearchResult>(emptySearchResult);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyResourceId, setBusyResourceId] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(`Search: ${query} · Nexus Vault`);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setSearching(true);
    setError(null);

    void searchWorkspace(query, controller.signal)
      .then((nextResults) => {
        if (!controller.signal.aborted) setResults(nextResults);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setResults(emptySearchResult);
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not search workspace.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });

    return () => controller.abort();
  }, [query, requestId]);

  useEffect(() => {
    const root = resultsRef.current;
    const highlights = (
      window.CSS as typeof CSS & { highlights?: HighlightRegistry }
    ).highlights;
    const HighlightConstructor = (
      window as typeof window & { Highlight?: new () => TextHighlight }
    ).Highlight;
    if (!root || !query || !highlights || !HighlightConstructor) return;

    const highlight = new HighlightConstructor();
    const normalizedQuery = query.toLocaleLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest("button, input, textarea, style")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const value = node.textContent ?? "";
      const normalizedValue = value.toLocaleLowerCase();
      let start = normalizedValue.indexOf(normalizedQuery);
      while (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + query.length);
        highlight.add(range);
        start = normalizedValue.indexOf(normalizedQuery, start + query.length);
      }
      node = walker.nextNode();
    }

    highlights.set("workspace-search-match", highlight);
    return () => {
      highlights.delete("workspace-search-match");
    };
  }, [query, results, viewMode]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = inputValue.trim();
    if (nextQuery) onSearch(nextQuery);
  }

  async function updateStar(resource: Resource) {
    if (busyResourceId) return;
    setBusyResourceId(resource.id);
    try {
      await setResourceStarred(resource.id, !resource.isStarred);
      setResults((current) => updateResource(current, resource.id, (item) => ({
        ...item,
        isStarred: !resource.isStarred,
      })));
      toast.add({
        title: resource.isStarred ? "Removed from starred" : "Resource starred",
        type: "success",
      });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setBusyResourceId("");
    }
  }

  async function updateReadLater(resource: Resource) {
    if (busyResourceId) return;
    setBusyResourceId(resource.id);
    try {
      await setResourceReadLater(resource.id, !resource.isReadLater);
      setResults((current) => updateResource(current, resource.id, (item) => ({
        ...item,
        isReadLater: !resource.isReadLater,
      })));
      toast.add({
        title: resource.isReadLater
          ? "Removed from watch later"
          : "Saved for later",
        type: "success",
      });
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource.",
        type: "error",
      });
    } finally {
      setBusyResourceId("");
    }
  }

  async function updateAnnotation(
    resourceId: string,
    patch: ResourceAnnotationPatch,
  ) {
    if (busyResourceId) return;
    setBusyResourceId(resourceId);
    try {
      const { annotation } = await updateResourceAnnotation(resourceId, patch);
      setResults((current) =>
        updateResource(current, resourceId, (resource) => ({
          ...resource,
          annotation,
        })),
      );
    } catch (reason) {
      toast.add({
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update resource note.",
        type: "error",
      });
    } finally {
      setBusyResourceId("");
    }
  }

  const resourceCount = results.resources.length;

  return (
    <section className="mx-auto w-full max-w-[112rem]">
      <header className="mb-7 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mono text-[10px] tracking-[0.12em] text-primary uppercase">
              Workspace search
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Search results
            </h1>
          </div>
          <Button
            className="shrink-0"
            onClick={onClose}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArrowLeft data-icon="inline-start" />
            Back to workspace
          </Button>
        </div>
        <form className="mt-6 max-w-3xl" onSubmit={submitSearch}>
          <SearchField
            ariaLabel="Search workspace"
            onValueChange={setInputValue}
            placeholder="Search titles, notes, metadata, URLs, vaults, or spaces"
            shortcut={null}
            value={inputValue}
          />
        </form>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {searching
            ? "Searching your workspace..."
            : `${resourceCount} ${resourceCount === 1 ? "resource" : "resources"} for “${query}”`}
        </p>
      </header>

      {searching ? <SearchResultSkeleton /> : null}

      {!searching && error ? (
        <div className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!searching && !error && resourceCount === 0 ? (
        <div className="grid min-h-56 place-items-center border border-dashed border-border bg-card/40 px-6 text-center">
          <div className="max-w-md">
            <h2 className="text-base font-medium text-foreground">
              No resources found
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Try a title, URL, note, metadata value, vault, or space name.
            </p>
          </div>
        </div>
      ) : null}

      {!searching && !error && resourceCount > 0 ? (
        <div ref={resultsRef}>
          <style>{`
            ::highlight(workspace-search-match) {
              background: color-mix(in oklch, var(--primary) 22%, transparent);
              color: var(--foreground);
              text-decoration: underline;
              text-decoration-color: color-mix(in oklch, var(--primary) 70%, transparent);
              text-underline-offset: 0.16em;
            }
          `}</style>
          <div
            className={
              viewMode === "masonry"
                ? "columns-1 gap-3 sm:columns-2 xl:columns-3 2xl:columns-4"
                : "grid grid-cols-[minmax(0,1fr)] gap-2"
            }
          >
            {results.resources.map((entry, index) => (
              <div
                className={
                  viewMode === "masonry"
                    ? "mb-3 break-inside-avoid"
                    : "min-w-0"
                }
                key={entry.resource.id}
              >
                <ResourceCard
                  canDeleteResource={false}
                  canEditResource={false}
                  disabled={busyResourceId === entry.resource.id}
                  index={index}
                  isActive={false}
                  isSignedIn
                  isVaultOwner={false}
                  mediaVisible={mediaVisible}
                  onCreateTransferTargetSpace={() => undefined}
                  onDelete={() => undefined}
                  onLoadTransferTargets={() => Promise.resolve()}
                  onOpenDetails={() => undefined}
                  onToggleReadLater={() => void updateReadLater(entry.resource)}
                  onToggleStar={() => void updateStar(entry.resource)}
                  onTransferResource={() => Promise.resolve()}
                  onUpdateAnnotation={(resourceId, patch) =>
                    void updateAnnotation(resourceId, patch)
                  }
                  resource={entry.resource}
                  spaceId={entry.spaceId ?? "unsorted"}
                  spaceName={entry.spaceName ?? "Unsorted"}
                  transferTargets={[]}
                  vaultId={entry.vaultId}
                  vaultName={entry.vaultTitle}
                  viewMode={viewMode}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type TextHighlight = {
  add: (range: Range) => void;
};

type HighlightRegistry = {
  delete: (name: string) => boolean;
  set: (name: string, highlight: TextHighlight) => unknown;
};

function updateResource(
  results: WorkspaceSearchResult,
  resourceId: string,
  update: (resource: Resource) => Resource,
): WorkspaceSearchResult {
  return {
    ...results,
    resources: results.resources.map((entry) =>
      entry.resource.id === resourceId
        ? { ...entry, resource: update(entry.resource) }
        : entry,
    ),
  };
}

function SearchResultSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Loading search results">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="h-40 animate-pulse rounded-md border border-border bg-card/60"
          key={index}
        />
      ))}
    </div>
  );
}
