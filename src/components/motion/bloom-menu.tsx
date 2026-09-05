"use client";
// beui.dev/components/blocks/bloom-menu

import {
  Bell,
  FileText,
  FolderClosed,
  LayoutGrid,
  Link,
  Plus,
  Table,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type MenuItem = { label: string; icon: ComponentType<{ className?: string }> };

const ITEMS: MenuItem[] = [
  { label: "Doc", icon: FileText },
  { label: "Board", icon: LayoutGrid },
  { label: "Table", icon: Table },
  { label: "Folder", icon: FolderClosed },
  { label: "Reminder", icon: Bell },
  { label: "Link", icon: Link },
];

// Folder-open feel: a touch of overshoot as the panel expands, kept subtle.
const SPRING_FOLDER = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 0.9,
} as const;

export interface BloomMenuProps {
  items?: MenuItem[];
  onSelect?: (label: string) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function BloomMenu({
  items = ITEMS,
  onSelect,
  className,
  triggerClassName,
  disabled = false,
  compact = false,
}: BloomMenuProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const layoutId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const morph = reduce ? { duration: 0.15 } : SPRING_FOLDER;

  return (
    <div ref={ref} className={cn("relative flex w-full min-w-0", className)}>
      {/* spacer fixes the anchor to the trigger size */}
      <div className="h-8 w-auto" aria-hidden />

      {/* The anchor fills the sidebar in its closed state. The open panel can
          extend into the inset while remaining above it in the sidebar layer. */}
      <div className={cn(
        "pointer-events-none absolute bottom-0 left-0 z-50 flex min-w-0 origin-bottom-left [&>*]:pointer-events-auto",
        open ? "w-[min(86vw,28rem)]" : "w-full",
        compact && !open ? "justify-center" : "justify-start",
      )}>
        {/* popLayout pulls the exiting trigger out of grid flow at once, so the
            grid never briefly holds two rows and shoves the panel off-center */}
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div
              key="panel"
              layoutId={layoutId}
              transition={morph}
              className="w-full overflow-hidden border border-border bg-card shadow-lg"
            >
              <motion.div
                // `layout` lets framer undo the box's morph scaling so this
                // content stays crisp instead of stretching with the resize.
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.12, duration: 0.2 }}
              >
                {/* header */}
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Create
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* grid */}
                <motion.div
                  // Iris reveal: start as a small box at the grid center and open
                  // outward to all four corners, so the menu grows from the middle
                  // in every direction instead of wiping top-down.
                  initial={
                    reduce ? false : { clipPath: "inset(45% 34% 45% 34%)" }
                  }
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  transition={{
                    delay: reduce ? 0 : 0.08,
                    duration: 0.45,
                    ease: EASE_OUT,
                  }}
                  className="grid grid-cols-2"
                >
                  {items.map((item, i) => {
                    // Radial stagger: delay each item by its distance from the
                    // grid center so the four corners animate together and the
                    // open reads as center-out, not corner-by-corner.
                    const cols = 2;
                    const rows = Math.ceil(items.length / cols);
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const dist = Math.hypot(
                      col - (cols - 1) / 2,
                      row - (rows - 1) / 2,
                    );
                    return (
                      <button
                        disabled={disabled}
                        key={item.label}
                        type="button"
                        onClick={() => {
                          onSelect?.(item.label);
                          setOpen(false);
                        }}
                      // Static cell with hairline borders (no animated fill) so
                      // the grid lines never flicker as items stagger in. Only the
                      // inner content animates.
                      className={cn(
                        "flex items-center justify-center px-3 py-6 text-muted-foreground transition-colors hover:text-foreground",
                        i % cols !== cols - 1 && "border-r border-border",
                        i < items.length - cols && "border-b border-border",
                      )}
                    >
                      <motion.span
                        initial={
                          reduce
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.85, filter: "blur(6px)" }
                        }
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        transition={{
                          delay: reduce ? 0 : 0.1 + dist * 0.07,
                          type: "spring",
                          stiffness: 440,
                          damping: 34,
                        }}
                        className="flex flex-col items-center gap-2"
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </motion.span>
                    </button>
                    );
                  })}
                </motion.div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.button
              key="trigger"
              type="button"
              disabled={disabled}
              layoutId={layoutId}
              transition={morph}
              onClick={() => setOpen(true)}
              aria-label={compact ? "Create" : undefined}
              aria-haspopup="menu"
              aria-expanded={open}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className={cn(
                "inline-flex h-8 w-full min-w-0 items-center justify-center border border-transparent bg-transparent px-2 text-ui font-normal text-foreground transition-colors hover:border-border hover:bg-muted",
                compact && "!w-8 !px-0",
                triggerClassName,
              )}
            >
              {/* own `layout` counter-scales the label so it stays crisp while the
                  button box morphs, instead of stretching with it */}
              <motion.span
                layout
                className="inline-flex items-center gap-2 whitespace-nowrap"
              >
                {compact ? <Plus aria-hidden="true" className="h-4 w-4" /> : <>Create<Plus className="h-4 w-4" /></>}
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
