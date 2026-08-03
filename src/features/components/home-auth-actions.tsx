"use client"

import { type FormEvent, useState } from "react"
import { ArrowRight, Fingerprint, Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import type { RegistrationMode } from "@/auth/registration"
import { Button } from "@/components/ui/button"
import { TurnstileField } from "@/components/turnstile-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "@/lib/router"

type AuthMode = "sign-in" | "sign-up"

type HomeAuthActionsProps = {
  placement: "header" | "hero"
  registrationMode: RegistrationMode
  turnstileSiteKey?: string
}

export function HomeAuthActions({
  placement,
  registrationMode,
  turnstileSiteKey,
}: HomeAuthActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  const isSignUp = mode === "sign-up"
  const canSignUp = registrationMode !== "login-only"
  const signUpLabel = registrationMode === "first-user" ? "创建第一个账号" : "创建账号"
  const heroSignUpLabel = registrationMode === "first-user" ? "创建第一个账号" : "开始创建 Vault"

  function openAuth(nextMode: AuthMode) {
    setMode(nextMode === "sign-up" && !canSignUp ? "sign-in" : nextMode)
    setError("")
    resetTurnstile()
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (turnstileSiteKey && !turnstileToken) return

    setIsSubmitting(true)
    setError("")

    try {
      const trimmedEmail = email.trim()
      const trimmedName = name.trim()

      const fetchOptions = turnstileToken
        ? { headers: { "x-captcha-response": turnstileToken } }
        : undefined
      const result = isSignUp
        ? await authClient.signUp.email({
            email: trimmedEmail,
            password,
            name: trimmedName || trimmedEmail,
            fetchOptions,
          })
        : await authClient.signIn.email({
            email: trimmedEmail,
            password,
            fetchOptions,
          })

      if (result.error) {
        setError(result.error.message ?? "认证失败，请稍后再试。")
        return
      }

      setOpen(false)
      router.replace("/dashboard")
      router.refresh()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "认证失败，请稍后再试。")
      resetTurnstile()
    } finally {
      setIsSubmitting(false)
      resetTurnstile()
    }
  }

  function resetTurnstile() {
    setTurnstileToken("")
    setTurnstileResetSignal((value) => value + 1)
  }

  return (
    <>
      {placement === "header" ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => openAuth("sign-in")}>
            登录
          </Button>
          {canSignUp && (
            <Button type="button" size="sm" onClick={() => openAuth("sign-up")}>
              <Fingerprint data-icon="inline-start" />
              {signUpLabel}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => openAuth(canSignUp ? "sign-up" : "sign-in")}
          >
            {canSignUp ? heroSignUpLabel : "登录控制台"}
            <ArrowRight data-icon="inline-end" />
          </Button>
          {canSignUp && (
            <Button type="button" size="lg" variant="outline" onClick={() => openAuth("sign-in")}>
              登录已有账号
            </Button>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="hidden" />
        <DialogContent className="border border-line bg-ink-850 text-fg">
          <DialogHeader>
            <DialogTitle>
              {isSignUp
                ? registrationMode === "first-user"
                  ? "创建第一个账号"
                  : "创建账号"
                : "登录 NexusVault"}
            </DialogTitle>
            <DialogDescription>
              {isSignUp
                ? registrationMode === "first-user"
                  ? "系统还没有用户，这个账号会成为第一个可登录应用的账号。"
                  : "使用邮箱和密码创建一个账号。"
                : "使用邮箱和密码进入控制台。"}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor={`${placement}-auth-name`}>名称</Label>
                <Input
                  id={`${placement}-auth-name`}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Username"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor={`${placement}-auth-email`}>邮箱</Label>
              <Input
                id={`${placement}-auth-email`}
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${placement}-auth-password`}>密码</Label>
              <Input
                id={`${placement}-auth-password`}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="rounded-input border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {turnstileSiteKey && (
              <div className="flex min-h-[65px] justify-center">
                <TurnstileField
                  action="auth"
                  onError={resetTurnstile}
                  onExpire={resetTurnstile}
                  onVerify={setTurnstileToken}
                  resetSignal={turnstileResetSignal}
                  siteKey={turnstileSiteKey}
                />
              </div>
            )}

            <Button type="submit" disabled={isSubmitting || Boolean(turnstileSiteKey && !turnstileToken)}>
              {isSubmitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {isSignUp ? "创建账号" : "登录"}
            </Button>
          </form>

          {canSignUp && (
            <div className="flex items-center justify-center text-sm text-fg-muted">
              {isSignUp ? "已有账号？" : "还没有账号？"}
              <Button
                type="button"
                variant="link"
                className="px-1.5"
                onClick={() => {
                  setMode(isSignUp ? "sign-in" : "sign-up")
                  setError("")
                }}
              >
                {isSignUp ? "去登录" : signUpLabel}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
