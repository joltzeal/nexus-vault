export type ParsedTwitterLink = { tweetId: string; username?: string; url: string }
export type ParsedTwitterProfileLink = { username: string; url: string }
export type ParsedGitHubLink =
  | { kind: "user"; login: string; url: string }
  | { kind: "repository"; owner: string; repository: string; url: string }
  | { kind: "release"; owner: string; repository: string; tag?: string; url: string }
export type ParsedTelegramMessageLink = { chatUsername?: string; internalChatId?: string; messageId: string; url: string }
export type ParsedWechatMpArticleLink = {
  articleToken?: string
  biz?: string
  idx?: string
  mid?: string
  sn?: string
  url: string
}

const TWITTER_RESERVED_PATHS = new Set([
  "home", "explore", "notifications", "messages", "settings", "i", "search",
])

function httpUrl(value: string | null | undefined) {
  try {
    const url = new URL((value ?? "").trim())
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

export function parseTwitterProfileLink(value: string | null | undefined): ParsedTwitterProfileLink | null {
  const url = httpUrl(value)
  if (!url || !["x.com", "twitter.com", "mobile.x.com"].includes(url.hostname.replace(/^www\./, ""))) return null
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length !== 1 || !/^[a-zA-Z0-9_]{1,15}$/.test(parts[0] ?? "")) return null
  if (TWITTER_RESERVED_PATHS.has((parts[0] ?? "").toLowerCase())) return null
  return { username: parts[0], url: `https://x.com/${parts[0]}` }
}

export function parseTwitterLink(value: string | null | undefined): ParsedTwitterLink | null {
  const url = httpUrl(value)
  if (!url || !["x.com", "twitter.com", "mobile.x.com"].includes(url.hostname.replace(/^www\./, ""))) return null
  const parts = url.pathname.split("/").filter(Boolean)
  const index = parts.findIndex((part) => ["status", "statuses"].includes(part.toLowerCase()))
  const tweetId = index >= 0 ? parts[index + 1] : undefined
  if (!tweetId || !/^\d+$/.test(tweetId)) return null
  return { tweetId, username: parts[index - 1], url: `https://x.com/${parts.slice(0, index + 2).join("/")}` }
}

export function parseGitHubLink(value: string | null | undefined): ParsedGitHubLink | null {
  const url = httpUrl(value)
  if (!url || url.hostname.replace(/^www\./, "") !== "github.com") return null
  const parts = url.pathname.split("/").filter(Boolean)
  const owner = parts[0]
  if (!owner) return null
  const repository = parts[1]
  if (!repository) return { kind: "user", login: owner, url: `https://github.com/${owner}` }
  if (parts[2]?.toLowerCase() === "releases") {
    if (parts[3]?.toLowerCase() === "latest") {
      return { kind: "release", owner, repository, url: `https://github.com/${owner}/${repository}/releases/latest` }
    }
    const tag = parts[3]?.toLowerCase() === "tag" && parts[4] ? decodeURIComponent(parts[4]) : undefined
    if (parts[3]?.toLowerCase() === "tag" && !tag) return null
    return { kind: "release", owner, repository, tag, url: tag
      ? `https://github.com/${owner}/${repository}/releases/tag/${encodeURIComponent(tag)}`
      : `https://github.com/${owner}/${repository}/releases` }
  }
  if (parts.length === 2) return { kind: "repository", owner, repository, url: `https://github.com/${owner}/${repository}` }
  return null
}

export function parseTelegramMessageLink(value: string | null | undefined): ParsedTelegramMessageLink | null {
  const url = httpUrl(value)
  if (!url || !["t.me", "telegram.me"].includes(url.hostname.replace(/^www\./, ""))) return null
  const parts = url.pathname.split("/").filter(Boolean)
  const offset = parts[0] === "s" ? 1 : 0
  const chatUsername = parts[offset]
  const messageId = parts[offset + 1]
  if (!chatUsername || !messageId) return null
  if (chatUsername.toLowerCase() === "c") {
    const internalChatId = messageId
    const privateMessageId = parts[offset + 2]
    if (!/^\d+$/.test(internalChatId) || !privateMessageId || !/^\d+$/.test(privateMessageId)) return null
    return { internalChatId, messageId: privateMessageId, url: `https://t.me/c/${internalChatId}/${privateMessageId}` }
  }
  if (!/^\d+$/.test(messageId) || !/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(chatUsername)) return null
  return { chatUsername, messageId, url: `https://t.me/${chatUsername}/${messageId}` }
}

export function parseWechatMpArticleLink(value: string | null | undefined): ParsedWechatMpArticleLink | null {
  const url = httpUrl(value)
  if (!url || url.hostname.replace(/^www\./, "") !== "mp.weixin.qq.com") return null
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts[0]?.toLowerCase() !== "s") return null
  const articleToken = parts[1] ? decodeURIComponent(parts[1]) : undefined
  const biz = url.searchParams.get("__biz")?.trim() || undefined
  const mid = url.searchParams.get("mid")?.trim() || undefined
  const idx = url.searchParams.get("idx")?.trim() || undefined
  const sn = url.searchParams.get("sn")?.trim() || undefined
  if (!articleToken && (!biz || !mid || !idx || !sn)) return null
  const canonical = articleToken
    ? `https://mp.weixin.qq.com/s/${encodeURIComponent(articleToken)}`
    : `https://mp.weixin.qq.com/s?__biz=${encodeURIComponent(biz!)}&mid=${encodeURIComponent(mid!)}&idx=${encodeURIComponent(idx!)}&sn=${encodeURIComponent(sn!)}`
  return { ...(articleToken ? { articleToken } : {}), ...(biz ? { biz } : {}), ...(mid ? { mid } : {}), ...(idx ? { idx } : {}), ...(sn ? { sn } : {}), url: canonical }
}
