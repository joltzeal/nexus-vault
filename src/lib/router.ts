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

export function usePathname() {
  return window.location.pathname
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search)
}
