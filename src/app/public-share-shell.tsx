import { Link2, ShieldCheck } from "lucide-react"
import { Outlet, useParams } from "react-router-dom"

export function PublicShareShell() {
  const { shareSlug } = useParams<{ shareSlug: string }>()

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex min-h-16 items-center justify-between border-b border-border px-5 sm:px-8">
        <a aria-label="NexusVault home" className="flex items-center gap-3" href="/">
          <span className="grid size-7 place-items-center border border-border bg-card text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.12em]">NEXUSVAULT</span>
        </a>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <Link2 className="size-3 text-primary" />
          Shared view
        </span>
      </header>
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <Outlet context={{ shareSlug }} />
      </div>
    </main>
  )
}
