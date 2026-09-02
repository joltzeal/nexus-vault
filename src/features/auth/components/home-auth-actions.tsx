/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { ArrowUpRight, LogIn, LogOut, Settings, UserPlus, UserRound } from "lucide-react";

import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import type { RegistrationMode } from "../types";
import { AuthDialog, type AuthMode } from "./auth-dialog";
import { authClient } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Button: any = ButtonPrimitive;

export function HomeAuthActions({
  placement,
  registrationMode = "open",
  turnstileSiteKey,
  openMode = null,
  onOpenModeChange,
  redirectTo,
}: {
  placement: "header" | "hero";
  registrationMode?: RegistrationMode;
  turnstileSiteKey?: string;
  openMode?: AuthMode | null;
  onOpenModeChange?: (mode: AuthMode | null) => void;
  redirectTo?: string | null;
}) {
  const canSignUp = registrationMode !== "login-only";
  const [open, setOpen] = useState(false);
  const [defaultMode, setDefaultMode] = useState<AuthMode>("sign-in");
  const session = authClient.useSession();
  const user = session.data?.user;

  useEffect(() => {
    if (!openMode) return;
    setDefaultMode(openMode);
    setOpen(true);
  }, [openMode]);

  function openAuth(mode: AuthMode) {
    setDefaultMode(mode);
    setOpen(true);
  }

  if (user) {
    const initials = user.name?.trim().slice(0, 2).toUpperCase() || "U";
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open user menu"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-card p-0 outline-none transition hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Avatar className="size-7" size="sm">
              <AvatarImage alt={user.name ?? user.email} src={user.image ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="flex flex-col gap-0.5">
                  <span className="truncate text-foreground">{user.name || "User"}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.assign("/dashboard/settings")}>
                <UserRound aria-hidden="true" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.assign("/dashboard/settings")}>
                <Settings aria-hidden="true" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void authClient.signOut()}>
                <LogOut aria-hidden="true" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <AuthDialog
          defaultMode={defaultMode}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) onOpenModeChange?.(null);
          }}
          open={open}
          redirectTo={redirectTo}
          registrationMode={registrationMode}
          turnstileSiteKey={turnstileSiteKey}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={
          placement === "header"
            ? "flex items-center gap-2"
            : "flex flex-wrap items-center gap-3"
        }
      >
        {placement === "header" ? (
          <>
            <Button
              icon={LogIn}
              onClick={() => openAuth("sign-in")}
              size="sm"
              type="button"
              variant="outline"
            >
              Sign in
            </Button>
            {canSignUp ? (
              <Button
                icon={UserPlus}
                onClick={() => openAuth("sign-up")}
                size="sm"
                type="button"
              >
                {registrationMode === "first-user"
                  ? "Create admin account"
                  : "Create account"}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button
              icon={ArrowUpRight}
              onClick={() => openAuth(canSignUp ? "sign-up" : "sign-in")}
              size="lg"
              type="button"
            >
              {canSignUp ? "Create your vault" : "Access your vault"}
            </Button>
            {canSignUp ? (
              <Button
                icon={UserPlus}
                onClick={() => openAuth("sign-in")}
                size="lg"
                type="button"
                variant="outline"
              >
                Sign in
              </Button>
            ) : null}
          </>
        )}
      </div>
      <AuthDialog
        defaultMode={defaultMode}
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) onOpenModeChange?.(null);
        }}
        redirectTo={redirectTo}
        registrationMode={registrationMode}
        turnstileSiteKey={turnstileSiteKey}
      />
    </>
  );
}
