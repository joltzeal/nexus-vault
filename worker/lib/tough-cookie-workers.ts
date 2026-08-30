export class Cookie {
  key: string
  value: string
  domain?: string
  path?: string
  secure = false
  maxAge?: number
  expires?: Date

  constructor(key: string, value: string) {
    this.key = key
    this.value = value
  }

  static parse(input: string) {
    const [pair, ...attributes] = input.split(";")
    const separator = pair?.indexOf("=") ?? -1
    if (separator <= 0) return undefined
    const cookie = new Cookie(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
    for (const attribute of attributes) {
      const [rawKey, ...rawValue] = attribute.trim().split("=")
      const name = rawKey?.toLowerCase()
      const value = rawValue.join("=").trim()
      if (name === "domain") cookie.domain = value.replace(/^\./, "").toLowerCase()
      if (name === "path") cookie.path = value || "/"
      if (name === "secure") cookie.secure = true
      if (name === "max-age") cookie.maxAge = Number.parseInt(value, 10)
      if (name === "expires") {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) cookie.expires = date
      }
    }
    return cookie
  }

  toString() {
    return `${this.key}=${this.value}`
  }
}

class MemoryCookieStore {
  constructor(private readonly cookies: Cookie[]) {}

  async removeCookie(domain: string, path: string, key: string) {
    const index = this.cookies.findIndex(
      (cookie) => cookie.domain === domain && cookie.path === path && cookie.key === key,
    )
    if (index >= 0) this.cookies.splice(index, 1)
  }
}

export class CookieJar {
  private readonly cookies: Cookie[] = []
  readonly store = new MemoryCookieStore(this.cookies)

  async setCookie(input: Cookie | string, url: string) {
    const parsed = new URL(url)
    const cookie = typeof input === "string" ? Cookie.parse(input) : input
    if (!cookie) throw new TypeError("Invalid cookie string.")
    cookie.domain ??= parsed.hostname
    cookie.path ??= "/"
    const existing = this.cookies.findIndex(
      (item) => item.key === cookie.key && item.domain === cookie.domain && item.path === cookie.path,
    )
    if (existing >= 0) this.cookies[existing] = cookie
    else this.cookies.push(cookie)
    return cookie
  }

  async getCookies(url: string) {
    const parsed = new URL(url)
    return this.cookies.filter((cookie) => {
      const domain = cookie.domain ?? parsed.hostname
      const domainMatches = parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      const pathMatches = parsed.pathname.startsWith(cookie.path ?? "/")
      return domainMatches && pathMatches && (!cookie.expires || cookie.expires > new Date())
    })
  }

  async removeAllCookies() {
    this.cookies.splice(0)
  }
}
