"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authClient } from "@nexus-vault/auth/client"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const error = searchParams.get("error") ?? ""
  const [form, setForm] = useState({
    confirmPassword: "",
    newPassword: "",
  })
  const [isBusy, setIsBusy] = useState(false)
  const [formError, setFormError] = useState(
    error ? "密码重置链接无效或已过期，请重新发送重置邮件。" : ""
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setFormError("缺少密码重置 token，请重新发送重置邮件。")
      return
    }
    if (!form.newPassword) return
    if (form.newPassword !== form.confirmPassword) {
      setFormError("两次输入的新密码不一致。")
      return
    }

    try {
      setIsBusy(true)
      setFormError("")
      const result = await authClient.resetPassword({
        newPassword: form.newPassword,
        token,
      })

      if (result.error) {
        setFormError(result.error.message ?? "密码重置失败，请稍后再试。")
        return
      }

      toast.success("密码已重置，请重新登录。")
      router.replace("/")
    } catch (resetError) {
      setFormError(resetError instanceof Error ? resetError.message : "密码重置失败，请稍后再试。")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-card border border-line bg-ink-850 p-5 shadow-pop">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-card border border-line bg-ink-900 text-jade">
            <KeyRound />
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold">重置密码</h1>
            <p className="mt-1 text-sm text-fg-dim">设置一个新的登录密码。</p>
          </div>
        </div>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-new-password">新密码</FieldLabel>
              <Input
                id="reset-new-password"
                minLength={8}
                type="password"
                value={form.newPassword}
                onChange={(event) =>
                  setForm((value) => ({ ...value, newPassword: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="reset-confirm-password">确认新密码</FieldLabel>
              <Input
                id="reset-confirm-password"
                minLength={8}
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((value) => ({ ...value, confirmPassword: event.target.value }))
                }
              />
            </Field>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              返回首页
            </Button>
            <Button
              disabled={isBusy || !form.newPassword || !form.confirmPassword || !token}
              type="submit"
            >
              保存新密码
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
