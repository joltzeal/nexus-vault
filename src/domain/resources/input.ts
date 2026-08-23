import type { ResourceFileType } from "./metadata"
import type { ResourceType } from "./types"

export type { ResourceType } from "./types"

export type ParsedResourceInput = {
  type: ResourceType
  url: string
  title: string
  metadata?: Record<string, unknown>
}

export type ParsedResourceFileType = Exclude<ResourceFileType, "folder">

export type ParsedEd2kLink = {
  fileName: string
  fileSize: number
  fileExtension?: string
  fileType: ParsedResourceFileType
  hash: string
}

export type ParsedThunderLink = {
  decodedUrl: string
  fileName?: string
  fileExtension?: string
  fileType?: ParsedResourceFileType
}

export type ParsedTwitterLink = {
  tweetId: string
  username?: string
  url: string
}

export type ParsedTwitterProfileLink = {
  username: string
  url: string
}

export type ParsedGitHubLink =
  | { kind: "user"; login: string; url: string }
  | { kind: "repository"; owner: string; repository: string; url: string }
  | {
      kind: "release"
      owner: string
      repository: string
      tag?: string
      url: string
    }

export type ParsedTelegramMessageLink = {
  chatUsername?: string
  internalChatId?: string
  messageId: string
  url: string
}

export type ParsedWechatMpArticleLink = {
  articleToken?: string
  biz?: string
  idx?: string
  mid?: string
  sn?: string
  url: string
}

export type ParsedDouyinLink = {
  host: string
  shareCode?: string
  url: string
  videoId?: string
}

export type ParsedFtpLink = {
  fileExtension?: string
  fileName?: string
  fileType?: ParsedResourceFileType
  host: string
  path: string
  port?: number
  url: string
}

export type ParsedHttpLink = {
  host: string
  url: string
}

export type CloudDriveProvider =
  | "baidu_pan"
  | "pan_115"
  | "pan_123"
  | "quark_pan"
  | "uc_pan"
  | "xunlei_pan"
  | "pikpak"

export type ParsedCloudDriveLink = ParsedHttpLink & {
  provider: CloudDriveProvider
  password?: string
  shareId?: string
}

export type ResourceInputParserInput = {
  type?: ResourceType
  title?: string
  url: string
  extractionCode?: string
}

export interface ResourceInputParser {
  name: string
  supports(input: Pick<ResourceInputParserInput, "type" | "url">): boolean
  parse(input: ResourceInputParserInput): ParsedResourceInput
}

export function parseResourceInput(
  input: ResourceInputParserInput,
): ParsedResourceInput {
  const url = normalizeResourceInputUrl(input.url)
  const parser = getResourceInputParser({
    type: input.type,
    url,
  })

  return parser.parse({
    ...input,
    url,
  })
}

export function inferResourceType(url: string): ResourceType {
  const normalizedUrl = normalizeResourceInputUrl(url)
  return getResourceInputParser({ url: normalizedUrl }).parse({ url: normalizedUrl }).type
}

export function parseMagnetLink(url: string) {
  const value = url.trim()
  const directInfoHash = normalizeInfoHash(value)
  if (directInfoHash) {
    return {
      infoHash: directInfoHash,
      displayName: undefined,
    }
  }
  if (!value.toLowerCase().startsWith("magnet:?")) return null

  const query = value.slice(value.indexOf("?") + 1)
  const params = new URLSearchParams(query)
  const xtValues = params.getAll("xt")
  const btih = xtValues
    .map((xt) => xt.match(/^urn:btih:([a-zA-Z0-9]{32,40})$/i)?.[1])
    .find((hash): hash is string => Boolean(hash))

  if (!btih) return null

  return {
    infoHash: btih.toUpperCase(),
    displayName: params.get("dn") ?? undefined,
  }
}

export function createCanonicalMagnetUrl(infoHash: string) {
  return `magnet:?xt=urn:btih:${infoHash.toUpperCase()}`
}

export function normalizeInfoHash(value: string) {
  const normalized = value.trim()

  return /^[a-fA-F0-9]{40}$/.test(normalized) ? normalized.toUpperCase() : null
}

export function parseEd2kLink(url: string): ParsedEd2kLink | null {
  const value = url.trim()
  const match = value.match(/^ed2k:\/\/\|file\|([^|]+)\|(\d+)\|([^|]+)\|\//i)
  if (!match) return null

  const fileName = decodeLinkPart(match[1])
  const fileSize = Number.parseInt(match[2], 10)
  const hash = match[3].trim()
  if (!fileName || !Number.isFinite(fileSize) || fileSize < 0 || !hash) {
    return null
  }

  const fileExtension = getFileExtension(fileName)

  return {
    fileName,
    fileSize,
    fileExtension,
    fileType: inferFileType(fileExtension),
    hash,
  }
}

export function parseThunderLink(url: string): ParsedThunderLink | null {
  const value = url.trim()
  if (!value.toLowerCase().startsWith("thunder://")) return null

  const payload = value.slice("thunder://".length).replace(/[?#].*$/, "")
  const decoded = decodeThunderPayload(payload)
  if (!decoded) return null

  const decodedUrl = stripThunderAffixes(decoded.trim())
  if (!decodedUrl) return null

  const file = getFileInfoFromUrl(decodedUrl)

  return {
    decodedUrl,
    fileName: file.fileName,
    fileExtension: file.fileExtension,
    fileType: file.fileType,
  }
}

export function parseTwitterLink(url: string): ParsedTwitterLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  const hostname = normalizeHostname(parsedUrl.hostname)
  if (!isTwitterHost(hostname)) return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  const statusIndex = segments.findIndex((segment) =>
    ["status", "statuses"].includes(segment.toLowerCase()),
  )
  const tweetId = statusIndex >= 0 ? segments[statusIndex + 1] : undefined
  if (!tweetId || !/^\d+$/.test(tweetId)) return null

  return {
    tweetId,
    username: statusIndex > 0 ? segments[statusIndex - 1] : undefined,
    url: `https://x.com/${segments.slice(0, statusIndex + 2).join("/")}`,
  }
}

export function parseTwitterProfileLink(url: string): ParsedTwitterProfileLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl || !isTwitterHost(normalizeHostname(parsedUrl.hostname))) return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  if (segments.length !== 1) return null
  const username = segments[0]
  if (!username || !/^[a-zA-Z0-9_]{1,15}$/.test(username)) return null
  if (TWITTER_RESERVED_PATHS.has(username.toLowerCase())) return null

  return {
    username,
    url: `https://x.com/${username}`,
  }
}

export function parseGitHubLink(url: string): ParsedGitHubLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl || normalizeHostname(parsedUrl.hostname) !== "github.com") return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null
  const [owner, repository, third, fourth] = segments
  if (!owner || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(owner)) return null

  if (!repository) {
    return { kind: "user", login: owner, url: `https://github.com/${owner}` }
  }

  if (third?.toLowerCase() === "releases") {
    if (fourth?.toLowerCase() === "latest") {
      return {
        kind: "release",
        owner,
        repository,
        url: `https://github.com/${owner}/${repository}/releases/latest`,
      }
    }
    if (fourth?.toLowerCase() === "tag" && segments[4]) {
      const tag = decodePathPart(segments[4])
      return {
        kind: "release",
        owner,
        repository,
        tag,
        url: `https://github.com/${owner}/${repository}/releases/tag/${encodeURIComponent(tag)}`,
      }
    }
  }

  if (segments.length !== 2) return null
  return {
    kind: "repository",
    owner,
    repository,
    url: `https://github.com/${owner}/${repository}`,
  }
}

export function parseTelegramMessageLink(url: string): ParsedTelegramMessageLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  const hostname = normalizeHostname(parsedUrl.hostname)
  if (hostname !== "t.me" && hostname !== "telegram.me") return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  if (segments.length < 2) return null

  const isWebPreviewPath = segments[0]?.toLowerCase() === "s"
  const offset = isWebPreviewPath ? 1 : 0
  const chatSegment = segments[offset]
  const messageSegment = segments[offset + 1]
  if (!chatSegment || !messageSegment || !/^\d+$/.test(messageSegment)) return null

  if (chatSegment.toLowerCase() === "c") {
    const internalChatId = segments[offset + 1]
    const privateMessageSegment = segments[offset + 2]
    if (!internalChatId || !privateMessageSegment) return null
    if (!/^\d+$/.test(internalChatId) || !/^\d+$/.test(privateMessageSegment)) return null

    return {
      internalChatId,
      messageId: privateMessageSegment,
      url: `https://t.me/c/${internalChatId}/${privateMessageSegment}`,
    }
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(chatSegment)) return null

  return {
    chatUsername: chatSegment,
    messageId: messageSegment,
    url: `https://t.me/${chatSegment}/${messageSegment}`,
  }
}

export function parseWechatMpArticleLink(url: string): ParsedWechatMpArticleLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  const host = normalizeHostname(parsedUrl.hostname)
  if (!isWechatMpHost(host)) return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  const firstSegment = segments[0]?.toLowerCase()
  if (firstSegment !== "s") return null

  const articleToken = segments[1] ? decodePathPart(segments[1]) : undefined
  const biz = parsedUrl.searchParams.get("__biz")?.trim() || undefined
  const mid = parsedUrl.searchParams.get("mid")?.trim() || undefined
  const idx = parsedUrl.searchParams.get("idx")?.trim() || undefined
  const sn = parsedUrl.searchParams.get("sn")?.trim() || undefined

  if (!articleToken && (!biz || !mid || !idx || !sn)) return null

  const canonical = articleToken
    ? `https://mp.weixin.qq.com/s/${encodeURIComponent(articleToken)}`
    : createWechatMpQueryUrl({ biz, idx, mid, sn })

  return {
    ...(articleToken ? { articleToken } : {}),
    ...(biz ? { biz } : {}),
    ...(idx ? { idx } : {}),
    ...(mid ? { mid } : {}),
    ...(sn ? { sn } : {}),
    url: canonical,
  }
}

export function parseDouyinLink(url: string): ParsedDouyinLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  const host = normalizeHostname(parsedUrl.hostname)
  if (!isDouyinHost(host)) return null

  const segments = parsedUrl.pathname.split("/").filter(Boolean)
  const contentSegmentIndex = segments.findIndex((segment) =>
    ["video", "note"].includes(segment.toLowerCase())
  )
  const videoId =
    contentSegmentIndex >= 0 ? segments[contentSegmentIndex + 1] : undefined
  const shareCode = host === "v.douyin.com" ? segments[0] : undefined

  return {
    host,
    ...(shareCode ? { shareCode } : {}),
    url: videoId ? `https://www.douyin.com/video/${videoId}` : parsedUrl.toString(),
    ...(videoId ? { videoId } : {}),
  }
}

export function parseFtpLink(url: string): ParsedFtpLink | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim())
  } catch {
    return null
  }

  if (parsedUrl.protocol.toLowerCase() !== "ftp:") return null
  const host = normalizeHostname(parsedUrl.hostname)
  if (!host) return null

  const path = decodePathname(parsedUrl.pathname)
  const fileName = path.split("/").filter(Boolean).pop()
  const fileExtension = fileName ? getFileExtension(fileName) : undefined

  return {
    fileExtension,
    fileName,
    fileType: inferFileType(fileExtension),
    host,
    path,
    port: parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : undefined,
    url: parsedUrl.toString(),
  }
}

export function parseCloudDriveLink(
  url: string,
  extractionCode?: string,
): ParsedCloudDriveLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  const host = normalizeHostname(parsedUrl.hostname)
  const config = cloudDriveConfigs.find((item) => item.matchesHost(host))
  if (!config) return null

  const shareId = getCloudDriveShareId(parsedUrl)
  if (!shareId) return null

  const password = getCloudDrivePassword(parsedUrl, extractionCode)

  return {
    provider: config.provider,
    host,
    url: createCloudDriveUrl(parsedUrl, config, password),
    password,
    shareId,
  }
}

export function isCloudDriveResourceType(
  type: ResourceType,
): type is CloudDriveProvider {
  return cloudDriveConfigs.some((item) => item.provider === type)
}

export function isCloudDriveLink(url: string) {
  return parseCloudDriveLink(url) !== null
}

export function getCloudDriveProviderLabel(provider: CloudDriveProvider) {
  return cloudDriveConfigs.find((item) => item.provider === provider)?.label ?? "网盘"
}

export function getCloudDrivePasswordParam(provider: CloudDriveProvider) {
  return (
    cloudDriveConfigs.find((item) => item.provider === provider)
      ?.passwordParam ?? "passcode"
  )
}

export function createCloudDriveUrlWithPassword(
  url: string,
  password: string,
) {
  const parsed = parseCloudDriveLink(url, password)
  return parsed?.url ?? url.trim()
}

export function parseHttpLink(url: string): ParsedHttpLink | null {
  const parsedUrl = parseHttpUrl(url)
  if (!parsedUrl) return null

  return {
    host: normalizeHostname(parsedUrl.hostname),
    url: parsedUrl.toString(),
  }
}

function defaultResourceTitle(type: ResourceType) {
  if (type === "magnet") return "名称未知"
  if (type === "twitter") return "Untitled tweet"
  if (type === "telegram") return "Telegram message"
  if (type === "douyin") return "抖音视频"
  if (type === "wechat_mp") return "微信公众号文章"
  if (type === "ftp") return "FTP link"
  if (isCloudDriveResourceType(type)) return getCloudDriveProviderLabel(type)
  if (type === "http") return "Untitled link"
  return "Untitled resource"
}

function normalizeInputTitle(value?: string) {
  const title = value?.trim()
  if (!title) return ""

  const fallbackTitles = new Set([
    "名称未知",
    "untitled resource",
    "untitled link",
    "untitled tweet",
  ])

  return fallbackTitles.has(title.toLowerCase()) ? "" : title
}

function createParsedResourceInput(
  input: ResourceInputParserInput,
  type: ResourceType,
  metadata?: Record<string, unknown>,
): ParsedResourceInput {
  return {
    type,
    url: input.url.trim(),
    title: normalizeInputTitle(input.title) || defaultResourceTitle(type),
    metadata,
  }
}

export const magnetInputParser: ResourceInputParser = {
  name: "magnet",
  supports(input) {
    return (
      input.type === "magnet" ||
      input.url.trim().toLowerCase().startsWith("magnet:?") ||
      normalizeInfoHash(input.url) !== null
    )
  },
  parse(input) {
    const parsed = parseMagnetLink(input.url)

    if (!parsed) {
      return createParsedResourceInput(input, "magnet")
    }

    return {
      type: "magnet",
      url: createCanonicalMagnetUrl(parsed.infoHash),
      title:
        normalizeInputTitle(input.title) ||
        parsed.displayName ||
        defaultResourceTitle("magnet"),
      metadata: {
        infoHash: parsed.infoHash,
        displayName: parsed.displayName,
      },
    }
  },
}

export const ed2kInputParser: ResourceInputParser = {
  name: "ed2k",
  supports(input) {
    return input.url.trim().toLowerCase().startsWith("ed2k://")
  },
  parse(input) {
    const parsed = parseEd2kLink(input.url)

    return {
      type: input.type ?? "other",
      url: input.url.trim(),
      title:
        normalizeInputTitle(input.title) ||
        parsed?.fileName ||
        defaultResourceTitle(input.type ?? "other"),
      metadata: {
        protocol: "ed2k",
        ...(parsed
          ? {
              fileName: parsed.fileName,
              fileSize: parsed.fileSize,
              size: parsed.fileSize,
              fileExtension: parsed.fileExtension,
              fileType: parsed.fileType,
              hash: parsed.hash,
            }
          : {}),
      },
    }
  },
}

export const httpInputParser: ResourceInputParser = {
  name: "http",
  supports(input) {
    return (
      input.type === "http" ||
      input.type === "twitter" ||
      input.type === "douyin" ||
      input.type === "wechat_mp" ||
      Boolean(input.type && isCloudDriveResourceType(input.type)) ||
      parseHttpLink(input.url) !== null
    )
  },
  parse(input) {
    const douyin = parseDouyinLink(input.url)
    if (input.type === "douyin" || douyin) {
      return {
        type: "douyin",
        url: douyin?.url ?? input.url.trim(),
        title: normalizeInputTitle(input.title) || defaultResourceTitle("douyin"),
        metadata: {
          ...(douyin
            ? {
                host: douyin.host,
                shareCode: douyin.shareCode,
                videoId: douyin.videoId,
              }
            : {}),
        },
      }
    }

    const twitter = parseTwitterLink(input.url)
    const twitterProfile = parseTwitterProfileLink(input.url)
    if (input.type === "twitter" || twitter || twitterProfile) {
      return {
        type: "twitter",
        url: twitter?.url ?? twitterProfile?.url ?? input.url.trim(),
        title: normalizeInputTitle(input.title) || defaultResourceTitle("twitter"),
        metadata: {
          ...(twitter
            ? {
                previewKind: "x_post",
                tweetId: twitter.tweetId,
                username: twitter.username,
              }
            : {}),
          ...(twitterProfile
            ? {
                previewKind: "x_profile",
                username: twitterProfile.username,
              }
            : {}),
        },
      }
    }

    const github = parseGitHubLink(input.url)
    if (github) {
      return {
        type: "http",
        url: github.url,
        title: normalizeInputTitle(input.title) || defaultResourceTitle("http"),
        metadata: {
          previewKind:
            github.kind === "user"
              ? "github_user"
              : github.kind === "repository"
                ? "github_repository"
                : "github_release",
          ...(github.kind === "user"
            ? { login: github.login }
            : {
                owner: github.owner,
                repository: github.repository,
                ...(github.kind === "release" && github.tag ? { tag: github.tag } : {}),
              }),
        },
      }
    }

    const telegram = parseTelegramMessageLink(input.url)
    if (input.type === "telegram" || telegram) {
      return {
        type: "telegram",
        url: telegram?.url ?? input.url.trim(),
        title: normalizeInputTitle(input.title) || defaultResourceTitle("telegram"),
        metadata: {
          ...(telegram
            ? {
                chatUsername: telegram.chatUsername,
                internalChatId: telegram.internalChatId,
                messageId: telegram.messageId,
              }
            : {}),
        },
      }
    }

    const wechatMp = parseWechatMpArticleLink(input.url)
    if (input.type === "wechat_mp" || wechatMp) {
      return {
        type: "wechat_mp",
        url: wechatMp?.url ?? input.url.trim(),
        title: normalizeInputTitle(input.title) || defaultResourceTitle("wechat_mp"),
        metadata: {
          ...(wechatMp
            ? {
                articleToken: wechatMp.articleToken,
                biz: wechatMp.biz,
                idx: wechatMp.idx,
                mid: wechatMp.mid,
                previewKind: "wechat_mp_article",
                sn: wechatMp.sn,
              }
            : {}),
        },
      }
    }

    const cloudDrive = parseCloudDriveLink(input.url, input.extractionCode)
    if (
      Boolean(input.type && isCloudDriveResourceType(input.type)) ||
      cloudDrive
    ) {
      const type =
        input.type && isCloudDriveResourceType(input.type)
          ? input.type
          : cloudDrive?.provider ?? "http"

      if (isCloudDriveResourceType(type)) {
        return {
          type,
          url: cloudDrive?.url ?? input.url.trim(),
          title: normalizeInputTitle(input.title) || defaultResourceTitle(type),
          metadata: {
            host: cloudDrive?.host,
            provider: cloudDrive?.provider ?? type,
            password: cloudDrive?.password,
            shareId: cloudDrive?.shareId,
          },
        }
      }
    }

    const http = parseHttpLink(input.url)
    return {
      type: "http",
      url: http?.url ?? input.url.trim(),
      title: normalizeInputTitle(input.title) || defaultResourceTitle("http"),
      metadata: {
        ...(http ? { host: http.host } : {}),
      },
    }
  },
}

export const ftpInputParser: ResourceInputParser = {
  name: "ftp",
  supports(input) {
    return input.type === "ftp" || input.url.trim().toLowerCase().startsWith("ftp://")
  },
  parse(input) {
    const parsed = parseFtpLink(input.url)

    return {
      type: "ftp",
      url: parsed?.url ?? input.url.trim(),
      title:
        normalizeInputTitle(input.title) ||
        parsed?.fileName ||
        parsed?.host ||
        defaultResourceTitle("ftp"),
      metadata: {
        ...(parsed
          ? {
              host: parsed.host,
              path: parsed.path,
              port: parsed.port,
              fileName: parsed.fileName,
              fileExtension: parsed.fileExtension,
              fileType: parsed.fileType,
            }
          : {}),
      },
    }
  },
}

export const thunderInputParser: ResourceInputParser = {
  name: "thunder",
  supports(input) {
    return input.url.trim().toLowerCase().startsWith("thunder://")
  },
  parse(input) {
    const parsed = parseThunderLink(input.url)

    return {
      type: input.type ?? "other",
      url: input.url.trim(),
      title:
        normalizeInputTitle(input.title) ||
        parsed?.fileName ||
        defaultResourceTitle(input.type ?? "other"),
      metadata: {
        protocol: "thunder",
        ...(parsed
          ? {
              decodedUrl: parsed.decodedUrl,
              fileName: parsed.fileName,
              fileExtension: parsed.fileExtension,
              fileType: parsed.fileType,
            }
          : {}),
      },
    }
  },
}

export const fallbackInputParser: ResourceInputParser = {
  name: "fallback",
  supports: () => true,
  parse(input) {
    return createParsedResourceInput(input, input.type ?? "other")
  },
}

const resourceInputParsers: ResourceInputParser[] = [
  magnetInputParser,
  ed2kInputParser,
  thunderInputParser,
  ftpInputParser,
  httpInputParser,
  fallbackInputParser,
]

export function getResourceInputParser(
  input: Pick<ResourceInputParserInput, "type" | "url">,
) {
  return (
    resourceInputParsers.find((parser) => parser.supports(input)) ??
    fallbackInputParser
  )
}

function decodeLinkPart(value: string) {
  const normalized = value.replace(/\+/g, "%20")

  try {
    return decodeURIComponent(normalized)
  } catch {
    return value
  }
}

function decodeThunderPayload(value: string) {
  const normalized = normalizeBase64(value)

  try {
    if (typeof atob === "function") return atob(normalized)
  } catch {
    // Ignore invalid browser base64 payloads and try the Node fallback.
  }

  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf8")
    }
  } catch {
    // Ignore invalid Node base64 payloads and fall through to null.
  }

  return null
}

function normalizeBase64(value: string) {
  const decodedValue = decodeLinkPart(value).replace(/-/g, "+").replace(/_/g, "/")
  const padding = decodedValue.length % 4

  return padding === 0
    ? decodedValue
    : decodedValue.padEnd(decodedValue.length + (4 - padding), "=")
}

function stripThunderAffixes(value: string) {
  return value.replace(/^AA/i, "").replace(/ZZ$/i, "")
}

function getFileInfoFromUrl(value: string) {
  const fallback = value.split(/[?#]/)[0]?.split("/").filter(Boolean).pop()
  let fileName = fallback ? decodeLinkPart(fallback) : undefined

  try {
    const url = new URL(value)
    const lastSegment = url.pathname.split("/").filter(Boolean).pop()
    fileName = lastSegment ? decodeLinkPart(lastSegment) : fileName
  } catch {
    // Keep the path-split fallback for non-URL inputs.
  }

  const fileExtension = fileName ? getFileExtension(fileName) : undefined

  return {
    fileName,
    fileExtension,
    fileType: fileExtension ? inferFileType(fileExtension) : undefined,
  }
}

function getFileExtension(fileName: string) {
  const cleanName = fileName.split(/[?#]/)[0] ?? fileName
  const match = cleanName.match(/\.([a-z0-9]{1,12})$/i)

  return match?.[1]?.toLowerCase()
}

function decodePathname(value: string) {
  return value
    .split("/")
    .map((part) => decodeLinkPart(part))
    .join("/")
}

function parseHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value.trim())
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl : null
  } catch {
    return null
  }
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "")
}

const TWITTER_RESERVED_PATHS = new Set([
  "home",
  "explore",
  "search",
  "settings",
  "notifications",
  "messages",
  "i",
  "intent",
  "compose",
  "login",
  "signup",
])

function isTwitterHost(hostname: string) {
  return hostname === "x.com" || hostname === "twitter.com" || hostname.endsWith(".x.com") || hostname.endsWith(".twitter.com")
}

function decodePathPart(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeResourceInputUrl(value: string) {
  const trimmed = value.trim()
  return extractFirstHttpUrl(trimmed) ?? trimmed
}

function extractFirstHttpUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"'，。！？、]+/i)
  if (!match) return null

  return match[0].replace(/[),.;!?，。！？、]+$/g, "")
}

function isDouyinHost(host: string) {
  return host === "douyin.com" ||
    host.endsWith(".douyin.com") ||
    host === "iesdouyin.com" ||
    host.endsWith(".iesdouyin.com")
}

function isWechatMpHost(host: string) {
  return host === "mp.weixin.qq.com"
}

function createWechatMpQueryUrl(input: {
  biz?: string
  idx?: string
  mid?: string
  sn?: string
}) {
  const url = new URL("https://mp.weixin.qq.com/s")
  if (input.biz) url.searchParams.set("__biz", input.biz)
  if (input.mid) url.searchParams.set("mid", input.mid)
  if (input.idx) url.searchParams.set("idx", input.idx)
  if (input.sn) url.searchParams.set("sn", input.sn)
  return url.toString()
}

type CloudDriveConfig = {
  provider: CloudDriveProvider
  label: string
  passwordParam?: "pwd" | "password" | "passcode"
  matchesHost: (host: string) => boolean
}

const cloudDriveConfigs: CloudDriveConfig[] = [
  {
    provider: "baidu_pan",
    label: "百度网盘",
    passwordParam: "pwd",
    matchesHost: (host) => host === "pan.baidu.com",
  },
  {
    provider: "pan_115",
    label: "115 盘",
    passwordParam: "password",
    matchesHost: (host) => host === "115cdn.com",
  },
  {
    provider: "pan_123",
    label: "123 云盘",
    passwordParam: "pwd",
    matchesHost: (host) => /^123\d{3}\.com$/.test(host),
  },
  {
    provider: "quark_pan",
    label: "夸克网盘",
    passwordParam: "passcode",
    matchesHost: (host) => host === "pan.quark.cn",
  },
  {
    provider: "uc_pan",
    label: "UC 网盘",
    passwordParam: "passcode",
    matchesHost: (host) => host === "drive.uc.cn",
  },
  {
    provider: "xunlei_pan",
    label: "迅雷网盘",
    passwordParam: "pwd",
    matchesHost: (host) => host === "pan.xunlei.com",
  },
  {
    provider: "pikpak",
    label: "PikPak",
    passwordParam: "passcode",
    matchesHost: (host) => host === "mypikpak.com",
  },
]

function getCloudDrivePassword(url: URL, fallback?: string) {
  return (
    fallback?.trim() ||
    url.searchParams.get("pwd")?.trim() ||
    url.searchParams.get("password")?.trim() ||
    url.searchParams.get("passcode")?.trim() ||
    undefined
  )
}

function getCloudDriveShareId(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean)
  const shareIndex = segments.findIndex((segment) =>
    ["s", "share"].includes(segment),
  )
  return shareIndex >= 0 ? segments[shareIndex + 1] : undefined
}

function createCloudDriveUrl(url: URL, config: CloudDriveConfig, password?: string) {
  const normalizedUrl = new URL(url.toString())
  const param = config.passwordParam

  if (param && password?.trim()) {
    normalizedUrl.searchParams.set(param, password.trim())
  }

  return normalizedUrl.toString()
}

function inferFileType(extension?: string): ParsedResourceFileType {
  if (!extension) return "unknown"

  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(extension)) {
    return "image"
  }
  if (["mp4", "mkv", "webm", "mov", "m4v", "avi", "wmv", "flv"].includes(extension)) {
    return "video"
  }
  if (["mp3", "flac", "wav", "aac", "ogg", "m4a"].includes(extension)) {
    return "audio"
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"].includes(extension)) {
    return "archive"
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "epub"].includes(extension)) {
    return "document"
  }
  if (["txt", "md", "json", "xml", "csv", "log", "srt"].includes(extension)) {
    return "text"
  }
  if (["ttf", "otf", "woff", "woff2"].includes(extension)) {
    return "font"
  }

  return "unknown"
}
