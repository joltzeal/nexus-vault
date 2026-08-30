import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import { parseWechatMpArticleLink } from "../../domain/resources/input"

import {
  RetryableMetadataError,
  type MetadataProvider,
  type MetadataProviderResource,
  type MetadataResult,
} from "../metadata-provider"

export const WECHAT_MP_PROVIDER = "wechat-mp-tikhub"
const ARTICLE_DETAIL_ENDPOINT = "https://api.tikhub.io/api/v1/wechat_mp/v2/fetch_article_detail"
const ARTICLE_DETAIL_TIMEOUT_MS = 30_000

export const wechatMpMetadataProvider: MetadataProvider = {
  name: WECHAT_MP_PROVIDER,
  supports(resource) {
    return resource.type === "wechat_mp" || parseWechatMpArticleLink(resource.url) !== null
  },
  async resolve(resource, options) {
    const parsed = parseWechatMpArticleLink(resource.url)
    const sourceUrl = parsed?.url ?? resource.url.trim()
    const baseMetadata = createBaseResourceMetadata({
      type: "wechat_mp",
      title: resource.title,
    })

    if (!parsed && resource.type !== "wechat_mp") {
      return {
        provider: WECHAT_MP_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid WeChat official account article URL.",
      }
    }

    const apiToken = options?.tikhubApiToken?.trim()
    if (!apiToken) {
      return {
        provider: WECHAT_MP_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "TIKHUB_API_TOKEN is not configured.",
      }
    }

    const requestBody = { url: sourceUrl, raw: true }
    logWechatMpRequest(ARTICLE_DETAIL_ENDPOINT, requestBody)

    const response = await fetchArticleDetail(sourceUrl, apiToken)
    const responseText = await response.clone().text().catch(() => "")
    logWechatMpResponse(response.status, responseText)

    if (!response.ok) {
      const message = `TikHub fetch_article_detail request failed with HTTP ${response.status}.`
      if (options?.retryTransient && (response.status === 429 || response.status >= 500)) {
        throw new RetryableMetadataError(message)
      }
      return {
        provider: WECHAT_MP_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: message,
      }
    }

    const payload = responseText ? safeJsonParse(responseText) : null
    if (!isRecord(payload) || Number(payload.code) !== 200 || !isRecord(payload.data)) {
      logWechatMpInvalidPayload(payload)
      return {
        provider: WECHAT_MP_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: getApiError(payload) ?? "TikHub returned an invalid fetch_article_detail response.",
      }
    }

    return createMetadataResult(resource, sourceUrl, payload.data)
  },
}

function fetchArticleDetail(url: string, apiToken: string) {
  return fetch(ARTICLE_DETAIL_ENDPOINT, {
    body: JSON.stringify({ url, raw: true }),
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(ARTICLE_DETAIL_TIMEOUT_MS),
  })
}

function logWechatMpRequest(endpoint: string, body: Record<string, unknown>) {
  console.info("[wechat-mp] request", {
    endpoint,
    body,
  })
}

function logWechatMpResponse(status: number, body: string) {
  console.info("[wechat-mp] response", {
    status,
    body: truncateLogValue(body),
  })
}

function logWechatMpInvalidPayload(payload: unknown) {
  console.info("[wechat-mp] invalid-payload", {
    payload: truncateLogValue(JSON.stringify(payload)),
  })
}

function createMetadataResult(
  resource: MetadataProviderResource,
  sourceUrl: string,
  data: Record<string, unknown>,
): MetadataResult {
  const content = recordValue(data.content) ?? {}
  const articleUrl = normalizeUrl(firstString(content.link, data.url, sourceUrl)) ?? sourceUrl
  const accountName = firstString(content.nick_name)
  const accountUsername = firstString(content.user_name)
  const accountAvatarUrl = normalizeUrl(firstString(
    content.round_head_img,
    content.hd_head_img,
    content.ori_head_img_url,
  ))
  const title = normalizeTitle(firstString(content.title, resource.title)) ?? "微信公众号文章"
  const contentHtml = firstString(content.content_noencode)
  const plainDescription = normalizeText(firstString(content.desc) ?? stripHtml(contentHtml))
  const authorName = firstString(content.author)
  const signature = firstString(content.signature)
  const coverUrl = normalizeUrl(firstString(
    content.cdn_url,
    content.cdn_url_16_9,
    content.cdn_url_1_1,
    content.cdn_url_235_1,
  ))
  const createdAt = normalizeArticleDate(firstString(content.create_time) ?? numberValue(content.ori_create_time))
  const messageId = firstString(content.msgId, content.mid, data.msgId)
  const bizUin = firstString(data.bizUin, content.bizUin, content.bizuin)
  const bizuin = firstString(content.bizuin)
  const idx = firstString(content.idx, data.itemIdx)
  const sn = firstString(content.sn)
  const articleToken = parseWechatMpArticleLink(sourceUrl)?.articleToken
  const tags = getPublicTags(content)
  const album = recordValue(content.appmsgalbuminfo)
  const albumTitle = firstString(album?.title)
  const ipLocation = getIpLocation(recordValue(content.ip_wording))
  const media = getArticleMedia({
    articleUrl,
    content,
    coverUrl,
    title,
  })

  return {
    provider: WECHAT_MP_PROVIDER,
    status: "completed",
    data: {
      ...createBaseResourceMetadata({
        type: "wechat_mp",
        title,
        fetchedAt: new Date().toISOString(),
      }),
      title,
      description: contentHtml ?? plainDescription ?? "",
      ...(media.length > 0 ? { media } : {}),
      identifiers: {
        ...(accountUsername ? { accountUsername } : {}),
        ...(articleToken ? { articleToken } : {}),
        ...(bizUin ? { bizUin } : {}),
        ...(bizuin ? { bizuin } : {}),
        ...(idx ? { idx } : {}),
        ...(messageId ? { messageId } : {}),
        ...(sn ? { sn } : {}),
      },
      source: {
        name: accountName ?? "微信公众号",
        url: articleUrl,
        attribution: {
          label: "TikHub",
          url: "https://api.tikhub.io/",
        },
      },
      preview: {
        kind: "wechat_mp_article",
        data: {
          ...(accountAvatarUrl ? { accountAvatarUrl } : {}),
          ...(accountName ? { accountName } : {}),
          ...(accountUsername ? { accountUsername } : {}),
          ...(albumTitle ? { albumTitle } : {}),
          ...(authorName ? { authorName } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...(plainDescription ? { excerpt: plainDescription } : {}),
          ...(ipLocation ? { ipLocation } : {}),
          ...(messageId ? { messageId } : {}),
          ...(signature ? { signature } : {}),
          ...(tags.length > 0 ? { tags } : {}),
          title,
          url: articleUrl,
        },
      },
      extra: {
        wechatMp: {
          api: ARTICLE_DETAIL_ENDPOINT,
          ...(albumTitle ? { albumTitle } : {}),
          ...(ipLocation ? { ipLocation } : {}),
          ...(plainDescription ? { excerpt: plainDescription } : {}),
          ...(signature ? { signature } : {}),
          ...(tags.length > 0 ? { tags } : {}),
        },
      },
    },
  }
}

function getArticleMedia(input: {
  articleUrl: string
  content: Record<string, unknown>
  coverUrl?: string
  title: string
}) {
  const media: ResourceMediaMetadata[] = []
  const seen = new Set<string>()
  const pushImage = (url?: string, sourceId?: string, width?: number, height?: number) => {
    const normalized = normalizeUrl(url)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    media.push({
      kind: "image",
      provider: WECHAT_MP_PROVIDER,
      sourceId,
      sourceUrl: input.articleUrl,
      thumbnailUrl: normalized,
      url: normalized,
      ...(height ? { height } : {}),
      ...(width ? { width } : {}),
    })
  }

  pushImage(input.coverUrl, "cover")
  for (const [index, url] of extractImageUrlsFromHtml(firstString(input.content.content_noencode)).entries()) {
    pushImage(url, `content:${index}`)
  }

  const pictureList = Array.isArray(input.content.picture_page_info_list)
    ? input.content.picture_page_info_list
    : []
  for (const [index, item] of pictureList.entries()) {
    if (!isRecord(item)) continue
    pushImage(
      firstString(item.cdn_url),
      `picture:${index}`,
      numberValue(item.width),
      numberValue(item.height),
    )
  }

  return media.slice(0, 12)
}

function extractImageUrlsFromHtml(value?: string) {
  if (!value) return []
  const urls: string[] = []
  const imagePattern = /<img\b[^>]*>/gi
  for (const match of value.matchAll(imagePattern)) {
    const tag = match[0]
    const src = getHtmlAttribute(tag, "data-src") ||
      getHtmlAttribute(tag, "src") ||
      getHtmlAttribute(tag, "data-original") ||
      getHtmlAttribute(tag, "data-backsrc")
    if (src) urls.push(src)
  }
  return [...new Set(urls)]
}

function getHtmlAttribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const match = tag.match(pattern)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function getPublicTags(content: Record<string, unknown>) {
  const publicTagInfo = recordValue(content.public_tag_info)
  const tags = Array.isArray(publicTagInfo?.tags) ? publicTagInfo.tags : []
  return [...new Set(tags.flatMap((item) => {
    if (!isRecord(item)) return []
    const tag = firstString(item.tag_name)
    return tag ? [tag] : []
  }))].slice(0, 6)
}

function getIpLocation(value?: Record<string, unknown>) {
  if (!value) return undefined
  return [firstString(value.country_name), firstString(value.province_name)]
    .filter(Boolean)
    .join(" · ") || undefined
}

function normalizeArticleDate(value?: string | number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1_000
    return new Date(milliseconds).toISOString()
  }
  if (typeof value !== "string" || !value.trim()) return undefined
  const normalized = value.trim()
  const chinaTime = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?$/)
  if (chinaTime) {
    return `${chinaTime[1]}T${chinaTime[2]}:${chinaTime[3] ?? "00"}+08:00`
  }
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? normalized : date.toISOString()
}

function normalizeUrl(value?: string) {
  if (!value) return undefined
  const decoded = decodeHtmlEntities(value).replace(/\\\//g, "/").trim()
  try {
    return new URL(decoded).toString()
  } catch {
    return undefined
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function truncateLogValue(value: string, limit = 2_000) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function getApiError(value: unknown) {
  if (!isRecord(value)) return undefined
  return firstString(value.message, value.msg, value.detail)
}

function stripHtml(value?: string) {
  return value
    ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
}

function normalizeText(value?: string) {
  return decodeHtmlEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5_000) || undefined
}

function normalizeTitle(value?: string) {
  return normalizeText(value)?.slice(0, 200)
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
