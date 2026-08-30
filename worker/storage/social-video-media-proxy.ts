import { isAllowedSocialVideoMediaUrl } from "../domain/social-video-media"

const MAX_REDIRECTS = 5

export async function getSocialVideoMediaProxyResponse(
  request: Request,
  sourceUrl: string,
) {
  let currentUrl = parseAllowedSocialVideoMediaUrl(sourceUrl)
  if (!currentUrl) return new Response("Invalid media URL.", { status: 400 })

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const upstream = await fetch(currentUrl.toString(), {
      headers: createUpstreamHeaders(request, currentUrl),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    })

    if (isRedirect(upstream.status)) {
      const location = upstream.headers.get("location")
      if (!location || redirects === MAX_REDIRECTS) {
        return new Response("Media redirect failed.", { status: 502 })
      }
      const redirectUrl = parseAllowedSocialVideoMediaUrl(
        new URL(location, currentUrl).toString(),
      )
      if (!redirectUrl) return new Response("Media redirect was rejected.", { status: 502 })
      currentUrl = redirectUrl
      continue
    }

    if (upstream.status !== 200 && upstream.status !== 206 && upstream.status !== 416) {
      upstream.body?.cancel().catch(() => undefined)
      return new Response("Upstream media is unavailable.", { status: 502 })
    }

    const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? ""
    if (
      upstream.status !== 416 &&
      contentType &&
      !contentType.startsWith("video/") &&
      !contentType.startsWith("audio/") &&
      !contentType.includes("octet-stream")
    ) {
      upstream.body?.cancel().catch(() => undefined)
      return new Response("Upstream response is not media.", { status: 502 })
    }

    return new Response(upstream.body, {
      headers: createResponseHeaders(upstream.headers),
      status: upstream.status,
    })
  }

  return new Response("Media redirect failed.", { status: 502 })
}

function parseAllowedSocialVideoMediaUrl(value: string) {
  try {
    const url = new URL(value)
    return isAllowedSocialVideoMediaUrl(url.toString()) ? url : null
  } catch {
    return null
  }
}

function createUpstreamHeaders(request: Request, url: URL) {
  const headers = new Headers({
    accept: request.headers.get("accept") || "video/*,audio/*;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    referer: getPlatformReferer(url.hostname),
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  })
  const range = request.headers.get("range")
  if (range) headers.set("range", range)
  return headers
}

function getPlatformReferer(hostname: string) {
  const host = hostname.toLowerCase()
  if (host.includes("tiktok") || host.endsWith("byteoversea.com")) {
    return "https://www.tiktok.com/"
  }
  if (host.includes("bili") || host.endsWith("hdslb.com")) {
    return "https://www.bilibili.com/"
  }
  return "https://www.douyin.com/"
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
