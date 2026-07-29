export function useRouter() {
  return {
    back() {
      window.history.back()
    },
    forward() {
      window.history.forward()
    },
    prefetch() {
      return Promise.resolve()
    },
    push(url: string) {
      window.location.assign(url)
    },
    refresh() {
      window.location.reload()
    },
    replace(url: string) {
      window.location.replace(url)
    },
  }
}

export function redirect(url: string): never {
  window.location.replace(url)
  throw new Error(`Redirected to ${url}`)
}

export function notFound(): never {
  throw new Error("Not found")
}

export function usePathname() {
  return window.location.pathname
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search)
}
