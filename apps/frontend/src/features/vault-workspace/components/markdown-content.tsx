"use client"

import ReactMarkdown from "react-markdown"

import { cn } from "@/lib/utils"

export function MarkdownContent({
  className,
  singleLine = false,
  value,
}: {
  className?: string
  singleLine?: boolean
  value: string
}) {
  const content = singleLine ? value.trim().replace(/\s+/g, " ") : value.trim()

  if (!content) return null

  return (
    <div
      className={cn(
        "min-w-0 max-w-none text-[12.5px] leading-relaxed text-fg-muted",
        "space-y-2 [&_a]:text-jade [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-jade-bright",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-jade-dim [&_blockquote]:pl-3 [&_blockquote]:text-fg-dim",
        "[&_code]:rounded-sm [&_code]:border [&_code]:border-line [&_code]:bg-ink-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-jade",
        "[&_h1]:font-display [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-fg",
        "[&_h2]:font-display [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-fg",
        "[&_h3]:font-display [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-fg",
        "[&_h4]:font-display [&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:text-fg",
        "[&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-input [&_img]:border [&_img]:border-line [&_img]:bg-ink-900",
        "[&_li]:pl-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded-input [&_pre]:border [&_pre]:border-line [&_pre]:bg-ink-900 [&_pre]:p-3 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:ml-5 [&_ul]:list-disc",
        singleLine &&
          "block overflow-hidden text-ellipsis whitespace-nowrap leading-5 [&_*:not(img)]:inline [&_br]:hidden [&_ol]:ml-0 [&_ul]:ml-0",
        className
      )}
    >
      <ReactMarkdown
      components={{
        a: ({ href, ...props }) => (
          <a href={href} rel="noreferrer" target="_blank" {...props} />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
