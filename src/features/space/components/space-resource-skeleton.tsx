import { cn } from "@/lib/utils";

export function SpaceResourceSkeleton({
  className,
  count = 3,
  viewMode,
}: {
  className?: string;
  count?: number;
  viewMode: "list" | "masonry";
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading resources"
      className={cn(
        viewMode === "masonry"
          ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-2",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          aria-hidden="true"
          className={cn(
            "animate-pulse border border-border bg-card p-3",
            viewMode === "masonry" && index % 3 === 1 ? "min-h-52" : "min-h-32",
          )}
          key={index}
        >
          <div className="h-3 w-3/5 bg-muted" />
          <div className="mt-3 h-2 w-full bg-muted" />
          <div className="mt-2 h-2 w-4/5 bg-muted" />
          {viewMode === "masonry" ? (
            <div className="mt-5 h-20 w-full bg-muted/70" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
