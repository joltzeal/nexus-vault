/* eslint-disable @typescript-eslint/no-explicit-any */

import { type ChangeEvent, type FormEvent, useEffect, useId, useState } from "react"
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound, X } from "lucide-react"

import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button"
import {
  Card as CardPrimitive,
  CardContent as CardContentPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
} from "@/components/aicanvas/andromeda/components/Card"
import { IconButton as IconButtonPrimitive } from "@/components/aicanvas/andromeda/components/IconButton"
import { Input as InputPrimitive } from "@/components/aicanvas/andromeda/components/Input"
import { authClient } from "@/lib/auth"
import type { RegistrationMode } from "../types"

// These Andromeda modules are JavaScript primitives whose prop declarations
// are documented in the component files but not emitted as TypeScript types.
const Button: any = ButtonPrimitive
const Card: any = CardPrimitive
const CardContent: any = CardContentPrimitive
const CardFooter: any = CardFooterPrimitive
const CardHeader: any = CardHeaderPrimitive
const IconButton: any = IconButtonPrimitive
const Input: any = InputPrimitive

export type AuthMode = "sign-in" | "sign-up"

export function AuthDialog({
  defaultMode = "sign-in",
  onOpenChange,
  open,
  registrationMode,
}: {
  defaultMode?: AuthMode
  onOpenChange: (open: boolean) => void
  open: boolean
  registrationMode: RegistrationMode
  turnstileSiteKey?: string
}) {
  const id = useId()
  const canSignUp = registrationMode !== "login-only"
  const [mode, setMode] = useState<AuthMode>(canSignUp ? defaultMode : "sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(canSignUp ? defaultMode : "sign-in")
      setError("")
    }
  }, [open, defaultMode, canSignUp])

  if (!open) return null

  const isSignUp = mode === "sign-up"
  const heading = isSignUp && registrationMode === "first-user"
    ? "Create the administrator account"
    : isSignUp
      ? "Create your account"
      : "Welcome back"

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setPending(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password })

      if (result.error) {
        setError(result.error.message || "Authentication failed.")
        return
      }

      onOpenChange(false)
      window.location.assign("/dashboard")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
      role="presentation"
    >
      <Card
        aria-labelledby={`${id}-title`}
        aria-modal="true"
        bordered
        className="w-full max-w-md text-foreground shadow-pop"
        role="dialog"
      >
        <CardHeader className="items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">NexusVault access</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]" id={`${id}-title`}>{heading}</h2>
          </div>
          <IconButton aria-label="Close" icon={X} onClick={() => onOpenChange(false)} size="sm" variant="ghost" />
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] border border-border p-1">
            {(["sign-in", ...(canSignUp ? ["sign-up"] : [])] as AuthMode[]).map((value) => (
              <Button
                className="w-full"
                key={value}
                onClick={() => {
                  setMode(value)
                  setError("")
                }}
                size="sm"
                type="button"
                variant={mode === value ? "default" : "ghost"}
              >
                {value === "sign-in" ? "Sign in" : "Sign up"}
              </Button>
            ))}
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {isSignUp ? (
              <label className="grid gap-2 text-sm" htmlFor={`${id}-name`}>
                <span className="flex items-center gap-2"><UserRound size={15} />Display name</span>
                <Input
                  autoComplete="name"
                  id={`${id}-name`}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
            ) : null}

            <label className="grid gap-2 text-sm" htmlFor={`${id}-email`}>
              <span className="flex items-center gap-2"><Mail size={15} />Email address</span>
              <Input
                autoComplete="email"
                id={`${id}-email`}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="grid gap-2 text-sm" htmlFor={`${id}-password`}>
              <span className="flex items-center gap-2"><LockKeyhole size={15} />Password</span>
              <span className="relative block">
                <Input
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="pr-12"
                  id={`${id}-password`}
                  minLength={8}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  required
                  type={visible ? "text" : "password"}
                  value={password}
                  wrapperClassName="w-full"
                />
                <IconButton
                  aria-label={visible ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  icon={visible ? EyeOff : Eye}
                  onClick={() => setVisible((value) => !value)}
                  size="sm"
                  variant="ghost"
                />
              </span>
            </label>

            {error ? <p aria-live="polite" className="text-sm text-destructive">{error}</p> : null}

            <Button className="mt-1 w-full" disabled={pending} icon={KeyRound} size="lg" type="submit">
              {pending ? "Please wait..." : isSignUp && registrationMode === "first-user" ? "Create admin account" : isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Private by default. You stay in control.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
