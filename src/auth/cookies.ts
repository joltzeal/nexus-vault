const SECURE_SESSION_COOKIE = "__Host-nexus-vault.session"
const LOCAL_SESSION_COOKIE = "nexus-vault.session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const SESSION_COOKIE_NAMES = [SECURE_SESSION_COOKIE, LOCAL_SESSION_COOKIE] as const

export function hasSessionCookie(input: Request | Headers) {
  return getSessionToken(input) !== null
}

export function getSessionToken(input: Request | Headers) {
  const headers = input instanceof Request ? input.headers : input
  const cookieHeader = headers.get("cookie")
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator < 1) continue

    const name = part.slice(0, separator).trim()
    if (!SESSION_COOKIE_NAMES.includes(name as (typeof SESSION_COOKIE_NAMES)[number])) {
      continue
    }

    const value = part.slice(separator + 1).trim()
    if (/^[a-f0-9]{64}$/.test(value)) return value
  }

  return null
}

export function createSessionHeaders(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:"
  const name = secure ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE
  const headers = new Headers({ "cache-control": "no-store" })
  headers.append(
    "set-cookie",
    `${name}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${
      secure ? "; Secure" : ""
    }`,
  )
  return headers
}

export function createClearSessionHeaders() {
  const headers = new Headers({ "cache-control": "no-store" })
  headers.append(
    "set-cookie",
    `${SECURE_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`,
  )
  headers.append(
    "set-cookie",
    `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  )
  return headers
}
