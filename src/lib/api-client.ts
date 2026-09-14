const UNAUTHORIZED_EVENT = "nexus-vault:unauthorized"

export function notifyUnauthorized() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
}

export function onUnauthorized(handler: () => void) {
  if (typeof window === "undefined") return () => undefined
  const listener = () => handler()
  window.addEventListener(UNAUTHORIZED_EVENT, listener)
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener)
}

export function installApiInterceptors() {
  if (typeof window === "undefined" || window.fetch.name === "nexusVaultFetch") return
  const originalFetch = window.fetch.bind(window)
  const nexusVaultFetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args)
    if (response.status === 401) notifyUnauthorized()
    return response
  }
  Object.defineProperty(nexusVaultFetch, "name", { value: "nexusVaultFetch" })
  window.fetch = nexusVaultFetch
}

export const apiEvents = { unauthorized: UNAUTHORIZED_EVENT }
