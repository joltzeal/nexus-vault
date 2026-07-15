import type { Metadata } from "next"
import { Suspense } from "react"

import { ResetPasswordClient } from "./reset-password-client"

export const metadata: Metadata = {
  title: "重置密码 · NexusVault",
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground">
          <section className="w-full max-w-md rounded-card border border-line bg-ink-850 p-5 shadow-pop">
            <p className="text-sm text-fg-dim">正在加载重置密码页面...</p>
          </section>
        </main>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
