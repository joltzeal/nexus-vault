export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const

const SESSION_COOKIE_NAME_SET: ReadonlySet<string> = new Set(SESSION_COOKIE_NAMES)
const MAX_SESSION_COOKIE_VALUES = 8
const MAX_ENCODED_COOKIE_LENGTH = 2048

export function hasSessionCookie(input: Request | Headers) {
  return getSessionCookieValues(input).length > 0
}

export function getSessionCookieValues(input: Request | Headers) {
  const headers = input instanceof Request ? input.headers : input
  const cookieHeader = headers.get("cookie")
  if (!cookieHeader) return []

  const values = new Set<string>()

  for (const part of cookieHeader.split(";", 64)) {
    const separator = part.indexOf("=")
    if (separator < 1) continue

    const name = part.slice(0, separator).trim()
    if (!SESSION_COOKIE_NAME_SET.has(name)) continue

    const encodedValue = part.slice(separator + 1).trim()
    if (!encodedValue || encodedValue.length > MAX_ENCODED_COOKIE_LENGTH) continue

    try {
      values.add(decodeURIComponent(encodedValue))
    } catch {
      values.add(encodedValue)
    }

    if (values.size === MAX_SESSION_COOKIE_VALUES) break
  }

  return [...values]
}
