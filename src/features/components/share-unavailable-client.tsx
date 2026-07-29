"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Clock, LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/lib/router"

export function ShareUnavailableClient() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(5)

  useEffect(() => {
    const redirectTimeout = window.setTimeout(() => {
      router.replace("/")
    }, 5000)
    const countdownInterval = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1))
    }, 1000)

    return () => {
      window.clearTimeout(redirectTimeout)
      window.clearInterval(countdownInterval)
    }
  }, [router])

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-card border border-line bg-ink-850 p-5 shadow-pop">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-card border border-line bg-ink-800 text-fg-muted">
            <LockKeyhole />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-xl font-semibold">Vault 不可用</h1>
            <p className="text-sm leading-6 text-fg-muted">
              该分享链接当前无法访问。Vault 可能已被设为私有、取消分享，或你没有访问权限。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-input border border-line bg-ink-900 px-3 py-2 text-xs text-fg-dim">
            <Clock />
            <span>{secondsLeft} 秒后返回主页</span>
          </div>
          <Button variant="outline" onClick={() => router.replace("/")}>
            <ArrowLeft data-icon="inline-start" />
            返回主页
          </Button>
        </div>
      </section>
    </main>
  )
}
