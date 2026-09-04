import { GOFILE_ACCOUNT_TOKEN_CACHE_KEY } from "../metadata/providers/gofile"

const GOFILE_API_URL = "https://api.gofile.io"
const GOFILE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
const MAX_REDIRECTS = 5

export async function getGofileMediaProxyResponse(
  request: Request,
  sourceUrl: string,
  env: CloudflareEnv,
) {
  const requestId = request.headers.get("cf-ray") || request.headers.get("x-request-id") || "unknown"
  let currentUrl = parseAllowedGofileMediaUrl(sourceUrl)
  if (!currentUrl) {
    logGofileProxyFailure("invalid_source_url", { requestId, sourceUrl })
    return new Response("Invalid GoFile media URL.", { status: 400 })
  }

  let accountToken: string
  try {
    accountToken = await getGofileAccountToken(env)
  } catch (error) {
    logGofileProxyFailure("account_token", {
      error: getErrorDetails(error),
      requestId,
    })
    return new Response("GoFile account token is unavailable.", { status: 502 })
  }

  let tokenRefreshes = 0
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let upstream: Response
    try {
      upstream = await fetch(currentUrl.toString(), {
        headers: await createUpstreamHeaders(request, accountToken),
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
      })
    } catch (error) {
      logGofileProxyFailure("fetch", {
        error: getErrorDetails(error),
        range: request.headers.get("range") || undefined,
        requestId,
        url: currentUrl.toString(),
      })
      return new Response("GoFile media request failed.", { status: 502 })
    }

    if (isRedirect(upstream.status)) {
      const location = upstream.headers.get("location")
      if (!location || redirects === MAX_REDIRECTS) {
        logGofileProxyFailure("redirect_limit_or_missing_location", {
          redirects,
          requestId,
          status: upstream.status,
          url: currentUrl.toString(),
        })
        return new Response(`GoFile media redirect failed (HTTP ${upstream.status}).`, { status: 502 })
      }
      const redirectUrl = new URL(location, currentUrl)
      const nextUrl = parseAllowedGofileMediaUrl(redirectUrl.toString())
      if (!nextUrl) {
        logGofileProxyFailure("redirect_rejected", {
          from: currentUrl.toString(),
          location: sanitizeUrl(redirectUrl),
          requestId,
          status: upstream.status,
        })
        return new Response("GoFile media redirect was rejected.", { status: 502 })
      }
      currentUrl = nextUrl
      continue
    }

    if (upstream.status !== 200 && upstream.status !== 206 && upstream.status !== 416) {
      logGofileProxyFailure("upstream_status", {
        contentLength: upstream.headers.get("content-length") || undefined,
        contentType: upstream.headers.get("content-type") || undefined,
        range: request.headers.get("range") || undefined,
        requestId,
        status: upstream.status,
        url: currentUrl.toString(),
      })
      if (
        (upstream.status === 401 || upstream.status === 403) &&
        !getConfiguredGofileToken(env) &&
        tokenRefreshes === 0
      ) {
        tokenRefreshes += 1
        await env.CACHE?.delete(GOFILE_ACCOUNT_TOKEN_CACHE_KEY)
        try {
          accountToken = await getGofileAccountToken(env)
          continue
        } catch (error) {
          logGofileProxyFailure("account_token_refresh", {
            error: getErrorDetails(error),
            requestId,
          })
        }
      }
      upstream.body?.cancel().catch(() => undefined)
      return new Response(`GoFile media is unavailable (upstream HTTP ${upstream.status}).`, { status: 502 })
    }

    const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? ""
    if (
      upstream.status !== 416 &&
      contentType &&
      !contentType.startsWith("video/") &&
      !contentType.startsWith("audio/") &&
      !contentType.startsWith("image/") &&
      !contentType.includes("octet-stream")
    ) {
      logGofileProxyFailure("not_media", {
        contentLength: upstream.headers.get("content-length") || undefined,
        contentType,
        requestId,
        status: upstream.status,
        url: currentUrl.toString(),
      })
      upstream.body?.cancel().catch(() => undefined)
      return new Response(`GoFile response is not media (${contentType || "unknown content type"}).`, { status: 502 })
    }

    return new Response(upstream.body, {
      headers: createResponseHeaders(upstream.headers),
      status: upstream.status,
    })
  }

  logGofileProxyFailure("redirect_exhausted", { requestId })
  return new Response("GoFile media redirect failed.", { status: 502 })
}

function parseAllowedGofileMediaUrl(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    if (
      url.protocol !== "https:" ||
      (hostname !== "gofile.io" && !hostname.endsWith(".gofile.io")) ||
      !url.pathname.startsWith("/download/")
    ) return null
    return url
  } catch {
    return null
  }
}

async function createUpstreamHeaders(request: Request, accountToken: string) {
  const headers = new Headers({
    accept: request.headers.get("accept") || "*/*",
    "accept-language": request.headers.get("accept-language") || "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: "https://gofile.io/",
    "user-agent": GOFILE_USER_AGENT,
    authorization: `Bearer ${accountToken}`,
    cookie: `accountToken=${accountToken}`,
    "x-website-token": await generateWebsiteToken(GOFILE_USER_AGENT, accountToken),
  })
  const range = request.headers.get("range")
  if (range) headers.set("range", range)
  return headers
}

async function getGofileAccountToken(env: CloudflareEnv) {
  const configuredToken = getConfiguredGofileToken(env)
  if (configuredToken) return configuredToken

  const cachedToken = env.CACHE ? await env.CACHE.get(GOFILE_ACCOUNT_TOKEN_CACHE_KEY) : null
  if (cachedToken?.trim()) return cachedToken.trim()

  const response = await fetch(`${GOFILE_API_URL}/accounts`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "user-agent": GOFILE_USER_AGENT,
      "x-bl": "en-US",
      "x-website-token": await generateWebsiteToken(GOFILE_USER_AGENT, ""),
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`GoFile account creation failed with HTTP ${response.status}.`)

  const payload = await response.json() as unknown
  const token = isRecord(payload) && isRecord(payload.data) && typeof payload.data.token === "string"
    ? payload.data.token.trim()
    : ""
  if (!token) throw new Error("GoFile account response did not contain an access token.")

  await env.CACHE?.put(GOFILE_ACCOUNT_TOKEN_CACHE_KEY, token, { expirationTtl: 24 * 60 * 60 })
  return token
}

function getConfiguredGofileToken(env: CloudflareEnv) {
  const bindings = env as CloudflareEnv & Record<string, string | undefined>
  return bindings.GOFILE_TOKEN?.trim() || bindings.GOFILE_API_TOKEN?.trim()
}

async function generateWebsiteToken(userAgent: string, accountToken: string) {
  const timeSlot = Math.floor(Date.now() / 1000 / 14_400)
  const raw = `${userAgent}::en-US::${accountToken}::${timeSlot}::12af056dacea0b`
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

function createResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  })
  for (const name of [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = upstreamHeaders.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function logGofileProxyFailure(reason: string, details: Record<string, unknown>) {
  console.error("GoFile media proxy failed", {
    reason,
    ...details,
  })
}

function getErrorDetails(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) }
}

function sanitizeUrl(url: URL) {
  const sanitized = new URL(url.toString())
  sanitized.username = ""
  sanitized.password = ""
  sanitized.search = ""
  sanitized.hash = ""
  return sanitized.toString()
}
