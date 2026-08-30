import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import {
  isCloudDriveLink,
  parseHttpLink,
} from "../../domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

export const httpPageMetadataProvider: MetadataProvider = {
  name: "http-page",
  supports: (resource) =>
    resource.type === "http" &&
    Boolean(parseHttpLink(resource.url)) &&
    !isCloudDriveLink(resource.url),
  async resolve(resource, options) {
    const parsed = parseHttpLink(resource.url)
    if (!parsed) {
      return {
        provider: "http-page",
        status: "failed",
        data: createBaseResourceMetadata({
          type: resource.type,
          title: resource.title,
        }),
        errorMessage: "Invalid HTTP URL.",
      }
    }

    const fetchedAt = new Date().toISOString()
    const pageResult =
      options?.fetchHttpPage === false
        ? {
            content: "",
            description: "",
            source: "skipped" as const,
            title: "",
            favicon: getDefaultFaviconUrl(parsed.url),
            warning: "HTTP page metadata fetch was skipped.",
          }
        : await fetchPageMetadata(parsed.url)
    const title = pageResult.title || resource.title
    let screenshotUrl: string | undefined
    let screenshotWarning: string | undefined

    if (options?.captureHttpScreenshot) {
      try {
        screenshotUrl = await options.captureHttpScreenshot({
          resourceId: resource.id,
          title,
          url: parsed.url,
        })
      } catch (error) {
        screenshotWarning =
          error instanceof Error ? error.message : "Screenshot capture failed."
      }
    }
    const media = screenshotUrl
      ? ([
          {
            kind: "image",
            provider: "browserless",
            sourceUrl: parsed.url,
            url: screenshotUrl,
            thumbnailUrl: screenshotUrl,
            height: 1080,
            mimeType: "image/png",
            width: 1920,
          },
        ] satisfies ResourceMediaMetadata[])
      : undefined

    return {
      provider: "http-page",
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: resource.type,
          title,
          fetchedAt,
        }),
        title,
        ...(pageResult.description ? { description: pageResult.description } : {}),
        ...(media ? { media } : {}),
        source: {
          name: "http-page",
          url: parsed.url,
        },
        extra: {
          http: {
            host: parsed.host,
            favicon: pageResult.favicon,
            titleSource: pageResult.source,
            ...(pageResult.content ? { content: pageResult.content } : {}),
            ...(pageResult.warning ? { warning: pageResult.warning } : {}),
            ...(screenshotWarning ? { screenshotWarning } : {}),
          },
        },
      },
    }
  },
}

async function fetchPageMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; NexusVaultMetadata/1.0; +https://nexus-vault.local)",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return {
        content: "",
        description: "",
        source: "fallback" as const,
        title: "",
        favicon: getDefaultFaviconUrl(url),
        warning: `Title request failed with HTTP ${response.status}.`,
      }
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (contentType && !contentType.includes("html")) {
      return {
        content: "",
        description: "",
        source: "fallback" as const,
        title: "",
        favicon: getDefaultFaviconUrl(url),
        warning: `Title request returned ${contentType}.`,
      }
    }

    const html = await response.text()
    const title = extractHtmlTitle(html)
    const description = extractMetaDescription(html)
    const content = extractPageText(html)
    const favicon = extractFaviconUrl(html, url) || getDefaultFaviconUrl(url)

    return {
      content,
      description,
      source: title ? ("html-title" as const) : ("fallback" as const),
      favicon,
      title,
      ...(title ? {} : { warning: "Page title was not found." }),
    }
  } catch (error) {
    return {
      content: "",
      description: "",
      source: "fallback" as const,
      title: "",
      favicon: getDefaultFaviconUrl(url),
      warning: error instanceof Error ? error.message : "Title request failed.",
    }
  }
}

function extractHtmlTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (!title) return ""

  return decodeHtmlEntities(title)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240)
}

function extractMetaDescription(html: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const name = getHtmlAttribute(tag, "name").toLowerCase()
    const property = getHtmlAttribute(tag, "property").toLowerCase()
    if (name !== "description" && property !== "og:description") continue

    const content = getHtmlAttribute(tag, "content")
      .replace(/\s+/g, " ")
      .trim()
    if (content) return content.slice(0, 1000)
  }
  return ""
}

function extractPageText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|article|section|main|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 16_000)
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number(code)
      return Number.isFinite(value) ? String.fromCodePoint(value) : ""
    })
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => {
      const value = Number.parseInt(code, 16)
      return Number.isFinite(value) ? String.fromCodePoint(value) : ""
    })
}

function extractFaviconUrl(html: string, pageUrl: string) {
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  const candidates = links
    .map((link) => {
      const rel = getHtmlAttribute(link, "rel").toLowerCase()
      const href = getHtmlAttribute(link, "href")
      if (!href || !rel.includes("icon")) return null

      return {
        href,
        priority: rel.includes("apple-touch-icon")
          ? 1
          : rel.includes("shortcut icon")
            ? 3
            : 2,
      }
    })
    .filter((item): item is { href: string; priority: number } => Boolean(item))
    .sort((a, b) => b.priority - a.priority)

  return resolveUrl(candidates[0]?.href, pageUrl)
}

function getDefaultFaviconUrl(pageUrl: string) {
  try {
    return new URL("/favicon.ico", pageUrl).toString()
  } catch {
    return ""
  }
}

function getHtmlAttribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const match = tag.match(pattern)
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim()
}

function resolveUrl(value: string | undefined, baseUrl: string) {
  if (!value) return ""

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return ""
  }
}
