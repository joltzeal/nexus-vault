import { Outlet, useParams } from "react-router-dom";
import { HomeAuthActions } from "@/features/auth/components/home-auth-actions";
import type { AuthMode } from "@/features/auth/components/auth-dialog";
import { useState } from "react";
import { Toaster } from "@/components/ui/toast";

export function PublicShareShell() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex min-h-16 items-center justify-between border-b border-border px-5 sm:px-8">
        <a aria-label="NexusVault home" className="flex items-center gap-3" href="/">
          <img alt="NexusVault" className="size-8 border border-border object-cover" src="/icon.svg" />
          <span className="font-mono text-xs font-semibold tracking-[0.12em]">NEXUSVAULT</span>
        </a>
        <HomeAuthActions
          onOpenModeChange={setAuthMode}
          openMode={authMode}
          placement="header"
          redirectTo={null}
        />
      </header>
      <div className="mt-3 p-5 sm:p-8">
        <Outlet context={{ requestAuth: (mode: AuthMode) => setAuthMode(mode), shareSlug }} />
      </div>
      <Toaster />
    </main>
  );
}
