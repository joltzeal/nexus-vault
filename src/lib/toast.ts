"use client"

import type { ReactNode } from "react"
import { toast as toastManager } from "@/components/ui/toast"

type ToastOptions = {
  id?: string
  description?: ReactNode
  duration?: number
}

function showToast(type: "success" | "error" | "info", title: string, options?: ToastOptions) {
  return toastManager.add({
    id: options?.id,
    title,
    description: options?.description,
    timeout: options?.duration,
    type,
    priority: type === "error" ? "high" : "low",
  })
}

export const toast = {
  success(title: string, options?: ToastOptions) {
    return showToast("success", title, options)
  },
  error(title: string, options?: ToastOptions) {
    return showToast("error", title, options)
  },
  info(title: string, options?: ToastOptions) {
    return showToast("info", title, options)
  },
  dismiss(id?: string) {
    toastManager.close(id)
  },
}
