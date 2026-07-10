"use client"

import { useEffect, useRef } from "react"

type TurnstileWidgetId = string

type TurnstileRenderOptions = {
  sitekey: string
  theme: "auto"
  action?: string
  callback: (token: string) => void
  "expired-callback": () => void
  "error-callback": () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => TurnstileWidgetId
      reset: (widgetId: TurnstileWidgetId) => void
      remove: (widgetId: TurnstileWidgetId) => void
    }
  }
}

let turnstileScriptPromise: Promise<void> | null = null

export function TurnstileField({
  action,
  onError,
  onExpire,
  onVerify,
  resetSignal,
  siteKey,
}: {
  action?: string
  onError?: () => void
  onExpire?: () => void
  onVerify: (token: string) => void
  resetSignal?: number
  siteKey?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const callbacksRef = useRef({ onError, onExpire, onVerify })

  callbacksRef.current = { onError, onExpire, onVerify }

  useEffect(() => {
    if (!siteKey) return

    let isMounted = true

    loadTurnstileScript()
      .then(() => {
        if (!isMounted || !containerRef.current || !window.turnstile) return

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          ...(action ? { action } : {}),
          callback: (token) => callbacksRef.current.onVerify(token),
          "expired-callback": () => callbacksRef.current.onExpire?.(),
          "error-callback": () => callbacksRef.current.onError?.(),
        })
      })
      .catch(() => {
        callbacksRef.current.onError?.()
      })

    return () => {
      isMounted = false
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, siteKey])

  useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
  }, [resetSignal])

  if (!siteKey) return null

  return <div ref={containerRef} />
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    )

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true })
      existingScript.addEventListener("error", () => reject(new Error("Turnstile failed to load.")), {
        once: true,
      })
      return
    }

    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile failed to load."))
    document.head.appendChild(script)
  })

  return turnstileScriptPromise
}
