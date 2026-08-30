"use client";

import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ResourceAiSummaryTransition } from "./resource-ai-summary";

export type ResourceAiSummary = {
  status: "pending" | "processing" | "completed" | "failed";
  text?: string;
};

export function ResourceDescription({
  aiSummary,
  description,
}: {
  aiSummary?: ResourceAiSummary | null;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const previousAiStatusRef = useRef(aiSummary?.status);
  const isStreaming =
    aiSummary?.status === "pending" || aiSummary?.status === "processing";
  const displayDescription =
    description ||
    (aiSummary?.status === "completed" ? aiSummary.text?.trim() ?? "" : "");

  useEffect(() => {
    // Reset the reader position when a refreshed resource description arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [description]);

  useEffect(() => {
    const previousStatus = previousAiStatusRef.current;
    if (
      aiSummary?.status === "completed" &&
      (previousStatus === "pending" || previousStatus === "processing")
    ) {
      setOpen(true);
    }
    previousAiStatusRef.current = aiSummary?.status;
  }, [aiSummary?.status]);

  if (isStreaming) {
    return <ResourceAiSummaryTransition text={aiSummary?.text ?? ""} />;
  }
  if (!displayDescription) return null;

  return (
    <div
      className={cn(
        "group/description relative min-w-0 cursor-pointer rounded-input border border-line-soft bg-ink-850/45 px-2 py-1 text-left outline-none transition hover:border-line hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:shadow-[0_0_0_3px_var(--jade-glow)]",
        open && "border-line bg-ink-850",
      )}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a,button"))
          return;
        event.stopPropagation();
        setOpen((value) => !value);
      }}
      onKeyDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button"))
          return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen((value) => !value);
      }}
      role="button"
      tabIndex={0}
    >
      {!open ? (
        <ResourceMarkdown
          className="text-xs leading-5 text-fg-dim"
          singleLine
          value={displayDescription}
        />
      ) : (
        <ResourceMarkdown
          className="text-xs leading-5 text-fg-muted"
          value={displayDescription}
        />
      )}
      <Button
        className={cn(
          "pointer-events-none absolute right-1 size-6 rounded-sm bg-ink-900/90 text-fg-dim opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within/description:pointer-events-auto group-focus-within/description:opacity-100 group-hover/description:pointer-events-auto group-hover/description:opacity-100 hover:text-jade",
          open
            ? "top-1"
            : "inset-y-0 my-auto",
        )}
        onClick={(event) => {
          event.stopPropagation();
          void navigator.clipboard?.writeText(displayDescription);
          toast.success("Description copied");
        }}
        size="icon-xs"
        title="Copy description"
        type="button"
        variant="ghost"
      >
        <Copy />
        <span className="sr-only">Copy description</span>
      </Button>
    </div>
  );
}

export function ResourceMarkdown({
  className,
  singleLine = false,
  value,
}: {
  className?: string;
  singleLine?: boolean;
  value: string;
}) {
  const content = singleLine ? getSingleLineContent(value) : value.trim();
  if (!content) return null;

  if (singleLine && content === "Expand description") {
    return (
      <div
        className={cn(
          "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] leading-5 text-fg-muted",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-w-0 max-w-none text-[12.5px] leading-relaxed text-fg-muted",
        "break-words [overflow-wrap:anywhere] [&_*]:max-w-full",
        "space-y-2 [&_a]:text-jade [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-jade-bright",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-jade-dim [&_blockquote]:pl-3 [&_blockquote]:text-fg-dim",
        "[&_code]:rounded-sm [&_code]:border [&_code]:border-line [&_code]:bg-ink-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-jade",
        "[&_h1]:font-display [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-fg",
        "[&_h2]:font-display [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-fg",
        "[&_h3]:font-display [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-fg",
        "[&_h4]:font-display [&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:text-fg",
        "[&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-input [&_img]:border [&_img]:border-line [&_img]:bg-ink-900",
        "[&_li]:pl-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded-input [&_pre]:border [&_pre]:border-line [&_pre]:bg-ink-900 [&_pre]:p-3 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:ml-5 [&_ul]:list-disc",
        singleLine &&
          "block overflow-hidden text-ellipsis whitespace-nowrap leading-5 [&_*:not(img)]:inline [&_br]:hidden [&_ol]:ml-0 [&_ul]:ml-0",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ href, ...props }) => (
            <a href={href} rel="noreferrer" target="_blank" {...props} />
          ),
          img: ({ alt, ...props }) =>
            singleLine ? (
              <span>{alt || "Expand description"}</span>
            ) : (
              <img alt={alt ?? ""} {...props} />
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function getSingleLineContent(value: string) {
  const firstLine = value
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "";
  if (
    /^!\[[^\]]*\]\([^\s)]+(?:\s+["'][^"']*["'])?\)/.test(firstLine) ||
    /^<img\b[^>]*>/i.test(firstLine)
  ) {
    return "Expand description";
  }

  return firstLine.replace(/\s+/g, " ");
}
