/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  FolderOpen,
  Link2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import {
  Card as CardPrimitive,
  CardContent as CardContentPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
} from "@/components/aicanvas/andromeda/components/Card";
import { HomeAuthActions } from "@/features/auth";
import type { RegistrationMode } from "@/features/auth";
import { useLocation } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";

// The Andromeda primitives are JavaScript modules with runtime prop contracts.
// Keep this page typed while consuming those contracts until their declaration
// files are generated.
const Card: any = CardPrimitive;
const CardContent: any = CardContentPrimitive;
const CardFooter: any = CardFooterPrimitive;
const CardHeader: any = CardHeaderPrimitive;

const resources = [
  ["LINK", "Brand visual references", "text-primary"],
  ["DOC", "Product requirements", "text-amber"],
  ["MEDIA", "Project media", "text-muted-foreground"],
] as const;

const capabilities = [
  [
    Waypoints,
    "Keep it together",
    "Bring links, files, video, and notes into one place where every important item has a clear home.",
  ],
  [
    Search,
    "Find it again",
    "Search by title, source, and description without relying on scattered chats and bookmarks.",
  ],
  [
    ShieldCheck,
    "Share with care",
    "Set access at the vault level and share with the right people while keeping control in your hands.",
  ],
] as const;

export function HomePage({
  registrationMode = "open",
  turnstileSiteKey,
}: {
  registrationMode?: RegistrationMode;
  turnstileSiteKey?: string;
}) {
  const { pathname } = useLocation();
  useDocumentTitle(
    pathname === "/login"
      ? "Sign in · Nexus Vault"
      : pathname === "/signup"
        ? "Create account · Nexus Vault"
        : "Nexus Vault",
  );

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-[74px] items-center justify-between border-b border-border">
          <a
            aria-label="NexusVault home"
            className="flex items-center gap-3"
            href="/"
          >
            <img
              alt=""
              className="size-8 border border-border bg-background p-1"
              src="/icon.svg"
            />
            <span className="font-mono text-[13px] font-semibold tracking-[0.12em]">
              NEXUS<span className="text-primary">VAULT</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground lg:flex">
              <CircleDot className="size-3 text-primary" />
              Private by default
            </span>
            <span className="hidden h-4 w-px bg-border lg:block" />
            <a
              className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground sm:block"
              href="#features"
            >
              Features
            </a>
            <HomeAuthActions
              placement="header"
              registrationMode={registrationMode}
              turnstileSiteKey={turnstileSiteKey}
            />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:gap-10 lg:py-20">
          <div className="max-w-[620px]">
            <div className="mb-7 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="text-primary">///</span>
              Your private library
            </div>
            <h1 className="max-w-[650px] text-[70px] font-semibold leading-[0.92] tracking-[-0.06em]">
              Keep what matters, close at hand.
            </h1>
            <p className="mt-8 max-w-[520px] text-[17px] leading-8 text-muted-foreground">
              NexusVault gives links, files, video, and online resources a
              private place to be saved, organized, and shared when needed.
            </p>
            <div className="mt-9">
              <HomeAuthActions
                placement="hero"
                registrationMode={registrationMode}
                turnstileSiteKey={turnstileSiteKey}
              />
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {[
                "Private vaults",
                "Controlled access",
                "Clear organization",
              ].map((item) => (
                <span className="flex items-center gap-2" key={item}>
                  <Check className="size-3 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative lg:justify-self-end">
            <div
              aria-hidden="true"
              className="absolute -inset-10 opacity-30 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:28px_28px]"
            />
            <Card bordered className="relative w-full max-w-[620px] shadow-pop">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Boxes className="size-4 text-primary" />
                  <span className="font-mono text-xs font-semibold tracking-[0.1em]">
                    PERSONAL VAULT
                  </span>
                </div>
                <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                  3 spaces · 128 items
                </span>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-[1.15fr_0.85fr]">
                <div className="border border-border bg-background">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Recently saved
                    </span>
                    <span className="size-2 bg-primary shadow-[0_0_14px_var(--primary)]" />
                  </div>
                  <div className="grid gap-1 p-2">
                    {resources.map(([type, label, tone]) => (
                      <div
                        className="group grid grid-cols-[52px_1fr_14px] items-center gap-3 border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-accent"
                        key={label}
                      >
                        <span
                          className={`font-mono text-[9px] font-bold tracking-[0.12em] ${tone}`}
                        >
                          {type}
                        </span>
                        <span className="truncate text-sm">{label}</span>
                        <ChevronRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="border border-border bg-accent p-4">
                    <div className="flex items-center justify-between">
                      <FolderOpen className="size-4 text-primary" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        SPACE 01
                      </span>
                    </div>
                    <strong className="mt-7 block text-xl font-medium tracking-[-0.04em]">
                      Plans &amp; ideas
                    </strong>
                    <span className="mt-1 block font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                      42 resources
                    </span>
                  </div>
                  <div className="border border-border bg-accent p-4">
                    <div className="flex items-center justify-between">
                      <LockKeyhole className="size-4 text-amber" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ACCESS
                      </span>
                    </div>
                    <strong className="mt-7 block text-xl font-medium tracking-[-0.04em]">
                      Invite only
                    </strong>
                    <span className="mt-1 block font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                      Owner controlled
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.13em] text-muted-foreground">
                  <Sparkles className="size-3 text-primary" />
                  Ready to revisit
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  SECURELY SAVED
                </span>
              </CardFooter>
            </Card>
          </div>
        </section>

        <section className="border-t border-border py-14" id="features">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                Core capabilities
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                A reliable way to manage what matters.
              </h2>
            </div>
            <p className="max-w-[330px] text-sm leading-6 text-muted-foreground">
              One place for personal collections, project materials, and shared
              knowledge.
            </p>
          </div>
          <div className="grid border-y border-border md:grid-cols-3 md:divide-x md:divide-border">
            {capabilities.map(([Icon, title, body], index) => (
              <article
                className="group min-h-[220px] p-5 transition-colors hover:bg-card md:p-7"
                key={title as string}
              >
                <div className="flex items-start justify-between">
                  <Icon className="size-5 text-primary" />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-12 max-w-[210px] text-xl font-medium tracking-[-0.035em]">
                  {title}
                </h3>
                <p className="mt-3 max-w-[270px] text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border py-6 font-mono text-[10px] tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <FileText className="size-3" />
            NexusVault · private knowledge management
          </span>
          <span className="flex items-center gap-2">
            <Link2 className="size-3 text-primary" />
            Save with confidence. Return anytime.
          </span>
        </footer>
      </div>
    </main>
  );
}
