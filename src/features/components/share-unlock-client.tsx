"use client"

import { LockKeyhole } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/features/api-client"
import { mapVaultDetail } from "@/features/mappers"
import type { Resource, ResourceSet, Space, Visibility } from "@/features/types"
import { VaultWorkspaceClient } from "@/features/dashboard"

export function ShareUnlockClient({
  slug,
  turnstileSiteKey,
}: {
  slug: string
  turnstileSiteKey?: string
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [set, setSet] = useState<ResourceSet | null>(null)

  async function handleUnlock() {
    if (!password.trim()) return

    try {
      setIsLoading(true)
      setError("")
      const passwordHash = await sha256Hex(password.trim())
      const detail = await apiRequest<{
        vault: {
          id: string
          title: string
          description: string
          visibility: Visibility
          collectionEnabled: boolean
          nsfwEnabled?: boolean
          createdAt: string
        }
        spaces: Space[]
        resources: Array<Resource & { spaceId: string | null }>
      }>(`/shares/${slug}/unlock`, {
        method: "POST",
        body: JSON.stringify({ passwordHash }),
      })

      setSet(mapVaultDetail(detail))
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "密码错误。")
    } finally {
      setIsLoading(false)
    }
  }

  if (set) {
    return (
      <VaultWorkspaceClient
        initialData={{
          sets: [set],
          activeSetId: set.id,
          mode: "share",
          shareSlug: slug,
          turnstileSiteKey,
        }}
      />
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-card border border-line bg-ink-850 p-5 shadow-pop">
        <div className="flex items-start gap-3 border-b border-line pb-4">
          <div className="grid size-11 place-items-center rounded-card border border-line bg-ink-800 text-jade">
            <LockKeyhole />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold">需要访问密码</h1>
            <p className="mt-1 text-sm text-fg-muted">输入分享者提供的密码后可查看这个 vault。</p>
          </div>
        </div>
        <div className="mt-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="share-unlock-password">分享密码</FieldLabel>
              <Input
                autoFocus
                autoComplete="new-password"
                id="share-unlock-password"
                name="nv-share-unlock-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleUnlock()
                }}
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleUnlock} disabled={isLoading || !password.trim()}>
              解锁
            </Button>
          </FieldGroup>
        </div>
      </section>
    </main>
  )
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
