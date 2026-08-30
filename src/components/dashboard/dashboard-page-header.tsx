import { ChevronRight } from "lucide-react"

export type DashboardPageHeaderProps = {
  breadcrumb: string
  title: string
  description?: string
}

/** Shared terminal-style heading used by dashboard pages. */
export function DashboardPageHeader({ breadcrumb, title, description }: DashboardPageHeaderProps) {
  return (
    <header className="mb-6 grid gap-2 border-b border-border pb-5">
      <div className="flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.12em] text-muted-foreground">
        <ChevronRight aria-hidden="true" className="size-3 text-primary" />
        <span>{breadcrumb}</span>
      </div>
      <h1 className="font-mono text-heading font-semibold tracking-[0.02em] text-foreground">{title}</h1>
      {description ? <p className="text-ui text-muted-foreground">{description}</p> : null}
    </header>
  )
}
