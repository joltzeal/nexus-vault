"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "@/lib/router"

export function DashboardSignOut() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await authClient.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
      <LogOut data-icon="inline-start" />
      {isSigningOut ? "退出中" : "退出"}
    </Button>
  )
}
