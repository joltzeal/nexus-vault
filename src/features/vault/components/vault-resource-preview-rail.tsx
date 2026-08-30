"use client";

import { createPortal } from "react-dom";

import { PreviewRail, type PreviewRailItem } from "@/components/motion/preview-rail";
import {
  getResourceDisplayUrl,
  getResourceTitle,
} from "@/features/resource/components/cards/view-models";
import type { Resource } from "@/features/resource/types";

export function VaultResourcePreviewRail({
  resources,
}: {
  resources: Resource[];
}) {
  const items: PreviewRailItem[] = resources.map((resource) => ({
    id: resource.id,
    label: getResourceTitle(resource),
    description: getResourceDisplayUrl(resource),
  }));

  const portalTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("dashboard-resource-preview-rail-layer");

  if (!items.length || !portalTarget) return null;

  return createPortal(
    <aside
      aria-label="Resource preview rail"
      className="dashboard-resource-preview-rail pointer-events-auto"
    >
      <PreviewRail
        defaultActiveId={items[0]?.id}
        items={items}
        itemSize={18}
        label="Resource navigation"
        onItemSelect={(item) =>
          document
            .getElementById(`resource-${item.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
        previewClassName="w-full"
        previewContainerClassName="!left-8 !right-auto !w-[min(22rem,calc(100vw-20rem))]"
        railClassName="!w-8 text-muted-foreground"
        renderPreview={(item) => (
          <div className="border border-border bg-card px-3 py-2 shadow-lg">
            <p className="truncate text-sm font-medium text-foreground">
              {item.label}
            </p>
            {item.description ? (
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        )}
      />
    </aside>,
    portalTarget,
  );
}
