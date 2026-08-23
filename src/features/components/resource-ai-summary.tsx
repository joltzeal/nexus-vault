import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/reasoning/reasoning"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

export function ResourceAiSummaryTransition({ text }: { text: string }) {
  return (
    <div className="min-w-0 rounded-input border border-jade-dim bg-ink-850/70 px-2.5 py-2 shadow-[inset_0_0_18px_var(--jade-glow)]">
      <Reasoning
        className="border-l-jade pl-2.5"
        defaultOpen
        isStreaming
      >
        <div className="flex items-center justify-between gap-2">
          <ReasoningTrigger className="mono py-1 text-[10px] text-jade hover:text-jade-bright">
            <span className="flex items-center gap-1.5">
              <Spinner className="size-3 text-jade" />
              <span className="shimmer shimmer-duration-2400">Generating summary</span>
            </span>
          </ReasoningTrigger>
          <Badge className="mono h-4 px-1.5 text-[9px]" variant="outline">
            AI
          </Badge>
        </div>
        <ReasoningContent className="mono [&>div]:text-xs [&>div]:leading-5 [&>div]:text-fg-muted">
          {text || "Analyzing resource metadata and drafting a concise Chinese summary…"}
        </ReasoningContent>
      </Reasoning>
    </div>
  )
}
