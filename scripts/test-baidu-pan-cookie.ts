import { writeFile } from "node:fs/promises"
import { join } from "node:path"

type StoredCookie = {
  name: string
  value: string
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  expires?: number
}

const [surl = "1cxgA4W7BhTxgmQ7I5yZoDQ", pwd = "Yu66", shareId = surl] =
  process.argv.slice(2)

const initUrl = `https://pan.baidu.com/share/init?surl=${encodeURIComponent(
  surl
)}&pwd=${encodeURIComponent(pwd)}`
const shareUrl = `https://pan.baidu.com/s/${encodeURIComponent(
  shareId
)}?pwd=${encodeURIComponent(pwd)}`

const commonHeaders = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding": "identity",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
}

async function main() {
  const outputDir = process.cwd()
  const jar = new CookieJar()

  console.log(`Output dir: ${outputDir}`)

  const init = await requestHtml(initUrl, {
    headers: {
      ...commonHeaders,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    },
  })
  jar.storeFromResponse(initUrl, init.setCookies)
  await writeResponse(outputDir, "init", init)

  console.log(`\n[1/2] GET ${initUrl}`)
  printResponse(init)
  console.log("\nCookie jar:")
  console.log(jar.toDebugString() || "(empty)")

  const share = await requestHtml(shareUrl, {
    headers: {
      ...commonHeaders,
      Referer: initUrl,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      Cookie: jar.getCookieHeader(shareUrl),
    },
  })
  jar.storeFromResponse(shareUrl, share.setCookies)
  await writeResponse(outputDir, "share", share)

  console.log(`\n[2/2] GET ${shareUrl}`)
  printResponse(share)
  console.log("\nFinal cookie jar:")
  console.log(jar.toDebugString() || "(empty)")

  if (share.status >= 300 && share.status < 400 && share.location) {
    const redirectUrl = new URL(share.location, shareUrl).toString()
    const redirected = await requestHtml(redirectUrl, {
      headers: {
        ...commonHeaders,
        Referer: shareUrl,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        Cookie: jar.getCookieHeader(redirectUrl),
      },
    })
    jar.storeFromResponse(redirectUrl, redirected.setCookies)
    await writeResponse(outputDir, "redirected", redirected)

    console.log(`\n[redirect] GET ${redirectUrl}`)
    printResponse(redirected)
    console.log("\nRedirected page source:")
    console.log(redirected.body)
  }
}

async function requestHtml(
  url: string,
  init: {
    headers: Record<string, string>
  }
) {
  const response = await fetch(url, {
    headers: init.headers,
    redirect: "manual",
  })
  const body = await response.text()

  return {
    body,
    headers: Object.fromEntries(response.headers.entries()),
    location: response.headers.get("location"),
    setCookies: getSetCookies(response.headers),
    status: response.status,
    statusText: response.statusText,
    url,
  }
}

async function writeResponse(
  outputDir: string,
  name: string,
  response: Awaited<ReturnType<typeof requestHtml>>
) {
  const headersPath = join(outputDir, `baidu-pan-${name}.headers.json`)
  const bodyPath = join(outputDir, `baidu-pan-${name}.html`)

  await writeFile(
    headersPath,
    JSON.stringify(
      {
        status: response.status,
        statusText: response.statusText,
        location: response.location,
        headers: response.headers,
        setCookies: response.setCookies,
      },
      null,
      2
    )
  )
  await writeFile(bodyPath, response.body)
}

function printResponse(response: Awaited<ReturnType<typeof requestHtml>>) {
  console.log(`Status: ${response.status} ${response.statusText}`)
  console.log(`Location: ${response.location ?? "(none)"}`)
  console.log("Set-Cookie:")
  if (response.setCookies.length === 0) {
    console.log("(none)")
  } else {
    for (const cookie of response.setCookies) console.log(cookie)
  }
  console.log(`Body bytes: ${Buffer.byteLength(response.body)}`)
  console.log("Body preview:")
  console.log(response.body.slice(0, 1600) || "(empty)")
}

function getSetCookies(headers: Headers) {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[]
    raw?: () => Record<string, string[]>
  }
  const setCookies = withGetSetCookie.getSetCookie?.()
  if (setCookies?.length) return setCookies

  const rawCookies = withGetSetCookie.raw?.()["set-cookie"]
  if (rawCookies?.length) return rawCookies

  const combined = headers.get("set-cookie")
  return combined ? splitCombinedSetCookie(combined) : []
}

function splitCombinedSetCookie(value: string) {
  const cookies: string[] = []
  let start = 0
  let inExpires = false

  for (let index = 0; index < value.length; index += 1) {
    const rest = value.slice(index)
    if (/^expires=/i.test(rest)) inExpires = true
    if (inExpires && value[index] === ";") inExpires = false
    if (inExpires || value[index] !== ",") continue

    const next = value.slice(index + 1)
    if (!/^\s*[^=;,\s]+=/.test(next)) continue

    cookies.push(value.slice(start, index).trim())
    start = index + 1
  }

  cookies.push(value.slice(start).trim())
  return cookies.filter(Boolean)
}

class CookieJar {
  private cookies: StoredCookie[] = []

  storeFromResponse(url: string, setCookies: string[]) {
    const responseUrl = new URL(url)

    for (const header of setCookies) {
      const cookie = parseSetCookie(header, responseUrl)
      if (!cookie) continue

      this.cookies = this.cookies.filter(
        (item) =>
          !(
            item.name === cookie.name &&
            item.domain === cookie.domain &&
            item.path === cookie.path
          )
      )

      if (cookie.expires !== undefined && cookie.expires <= Date.now()) continue
      this.cookies.push(cookie)
    }
  }

  getCookieHeader(url: string) {
    const requestUrl = new URL(url)
    const now = Date.now()
    const pairs = this.cookies
      .filter((cookie) => {
        if (cookie.expires !== undefined && cookie.expires <= now) return false
        if (cookie.secure && requestUrl.protocol !== "https:") return false
        if (!domainMatches(requestUrl.hostname, cookie)) return false
        return pathMatches(requestUrl.pathname, cookie.path)
      })
      .map((cookie) => `${cookie.name}=${cookie.value}`)

    return pairs.join("; ")
  }

  toDebugString() {
    return this.cookies
      .map((cookie) => {
        const flags = [
          cookie.hostOnly ? "hostOnly" : `domain=${cookie.domain}`,
          `path=${cookie.path}`,
          cookie.secure ? "secure" : "",
          cookie.httpOnly ? "httpOnly" : "",
        ].filter(Boolean)

        return `${cookie.name}=${cookie.value}; ${flags.join("; ")}`
      })
      .join("\n")
  }
}

function parseSetCookie(header: string, responseUrl: URL): StoredCookie | null {
  const parts = header.split(";").map((part) => part.trim())
  const [nameValue, ...attributes] = parts
  const separatorIndex = nameValue.indexOf("=")
  if (separatorIndex <= 0) return null

  const name = nameValue.slice(0, separatorIndex)
  const value = nameValue.slice(separatorIndex + 1)
  let domain = responseUrl.hostname.toLowerCase()
  let hostOnly = true
  let path = defaultCookiePath(responseUrl.pathname)
  let secure = false
  let httpOnly = false
  let expires: number | undefined

  for (const attribute of attributes) {
    const [rawKey, ...rawValue] = attribute.split("=")
    const key = rawKey.trim().toLowerCase()
    const attrValue = rawValue.join("=").trim()

    if (key === "domain" && attrValue) {
      domain = attrValue.toLowerCase().replace(/^\./, "")
      hostOnly = false
    } else if (key === "path" && attrValue) {
      path = attrValue
    } else if (key === "secure") {
      secure = true
    } else if (key === "httponly") {
      httpOnly = true
    } else if (key === "expires" && attrValue) {
      const parsed = Date.parse(attrValue)
      if (Number.isFinite(parsed)) expires = parsed
    } else if (key === "max-age" && attrValue) {
      const seconds = Number.parseInt(attrValue, 10)
      if (Number.isFinite(seconds)) expires = Date.now() + seconds * 1000
    }
  }

  return { name, value, domain, hostOnly, path, secure, httpOnly, expires }
}

function domainMatches(hostname: string, cookie: StoredCookie) {
  const host = hostname.toLowerCase()
  if (cookie.hostOnly) return host === cookie.domain
  return host === cookie.domain || host.endsWith(`.${cookie.domain}`)
}

function pathMatches(pathname: string, cookiePath: string) {
  if (pathname === cookiePath) return true
  if (pathname.startsWith(cookiePath)) return true
  return cookiePath === "/" && pathname.startsWith("/")
}

function defaultCookiePath(pathname: string) {
  if (!pathname || !pathname.startsWith("/")) return "/"
  const index = pathname.lastIndexOf("/")
  if (index <= 0) return "/"
  return pathname.slice(0, index)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
