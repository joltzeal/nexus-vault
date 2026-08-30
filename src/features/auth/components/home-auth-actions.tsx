/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { ArrowUpRight, LogIn, UserPlus } from "lucide-react";

import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import type { RegistrationMode } from "../types";
import { AuthDialog, type AuthMode } from "./auth-dialog";

const Button: any = ButtonPrimitive;

export function HomeAuthActions({
  placement,
  registrationMode = "open",
  turnstileSiteKey,
}: {
  placement: "header" | "hero";
  registrationMode?: RegistrationMode;
  turnstileSiteKey?: string;
}) {
  const canSignUp = registrationMode !== "login-only";
  const [open, setOpen] = useState(false);
  const [defaultMode, setDefaultMode] = useState<AuthMode>("sign-in");

  function openAuth(mode: AuthMode) {
    setDefaultMode(mode);
    setOpen(true);
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
        onOpenChange={setOpen}
        open={open}
        registrationMode={registrationMode}
        turnstileSiteKey={turnstileSiteKey}
      />
    </>
  );
}
