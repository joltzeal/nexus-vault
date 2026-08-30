import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import { parseTelegramMessageLink } from "../../domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

type TelegramMetadataApiResponse = {
  ok?: boolean
  error?: string
  metadata?: TelegramMessageMetadata
}

type TelegramMessageMetadata = {
  url?: string
  authorAvatarUrl?: string | null
  authorId?: string | null
  chatTitle?: string
  chatUsername?: string | null
  chatAvatarUrl?: string | null
  chatType?: "channel" | "group" | "private" | null
  internalChatId?: string | null
  messageId?: string | number
  text?: string | null
  date?: string | null
  authorName?: string | null
  authorUsername?: string | null
  editedAt?: string | null
  views?: number | null
  forwards?: number | null
  replies?: number | null
  reactions?: TelegramReactionMetadata[]
  permalink?: string | null
  media?: TelegramMediaMetadata[]
}

type TelegramReactionMetadata = {
  emoji?: string
  count?: number
}

type TelegramMediaMetadata = {
  messageId?: string | number
  type?: string
  url?: string | null
  thumbnailUrl?: string | null
  streamUrl?: string | null
  mimeType?: string | null
  fileName?: string | null
  size?: number | null
  width?: number | null
  height?: number | null
  duration?: number | null
}

export const telegramMetadataProvider: MetadataProvider = {
  name: "telegram",
  supports: (resource) =>
    resource.type === "telegram" || parseTelegramMessageLink(resource.url) !== null,
  async resolve(resource, options) {
    const parsed = parseTelegramMessageLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({
      type: "telegram",
      title: resource.title,
    })

    if (!parsed) {
      return {
        provider: "telegram",
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid Telegram message URL.",
      }
    }

    if (!options?.telegramMetadataApiUrl) {
      return {
        provider: "telegram",
        status: "failed",
        data: {
          ...baseMetadata,
          identifiers: getTelegramIdentifiers(parsed),
          source: {
            name: "telegram",
            url: parsed.url,
          },
          preview: {
            kind: "telegram_message",
            data: {
              chatUsername: parsed.chatUsername,
              messageId: parsed.messageId,
              url: parsed.url,
            },
          },
        },
        errorMessage: "TELEGRAM_METADATA_API_URL is not configured.",
      }
    }

    const apiResult = await fetchTelegramMetadata({
      endpoint: options.telegramMetadataApiUrl,
      token: options.telegramMetadataApiToken,
      url: parsed.url,
      resourceId: resource.id,
    })

    if (!apiResult.ok || !apiResult.metadata) {
      return {
        provider: "telegram",
        status: "failed",
        data: {
          ...baseMetadata,
          identifiers: getTelegramIdentifiers(parsed),
          source: {
            name: "telegram",
            url: parsed.url,
          },
          preview: {
            kind: "telegram_message",
            data: {
              chatUsername: parsed.chatUsername,
              messageId: parsed.messageId,
              url: parsed.url,
            },
          },
        },
        errorMessage: apiResult.error || "Telegram metadata service returned no metadata.",
      }
    }

    const metadata = apiResult.metadata
    const chatAvatarSource = normalizeString(metadata.chatAvatarUrl)
    const authorAvatarSource = normalizeString(metadata.authorAvatarUrl)
    const chatAvatarUrl = await persistTelegramAvatar({
      persist: options?.persistTelegramMedia,
      resourceId: resource.id,
      sourceId:
        normalizeString(metadata.internalChatId) ??
        normalizeString(metadata.chatUsername) ??
        parsed.internalChatId ??
        parsed.chatUsername,
      url: chatAvatarSource,
      mediaType: "chat-avatar",
    })
    const authorAvatarUrl = authorAvatarSource && authorAvatarSource === chatAvatarSource
      ? chatAvatarUrl
      : await persistTelegramAvatar({
          persist: options?.persistTelegramMedia,
          resourceId: resource.id,
          sourceId: normalizeString(metadata.authorId),
          url: authorAvatarSource,
          mediaType: "author-avatar",
        })
    const media = await persistTelegramMedia(
      Array.isArray(metadata.media) ? metadata.media.filter(isTelegramMedia) : [],
      {
        resourceId: resource.id,
        persist: options?.persistTelegramMedia,
      },
    )
    const title = getTelegramTitle(metadata, parsed)
    const description = normalizeString(metadata.text)
    const reactions = normalizeReactions(metadata.reactions)
    const chatType = normalizeChatType(metadata.chatType)

    return {
      provider: "telegram",
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: "telegram",
          title,
        }),
        title,
        description,
        media: getNormalizedResourceMedia(media),
        identifiers: getTelegramIdentifiers(parsed),
        source: {
          name: "telegram",
          url: normalizeString(metadata.permalink) || normalizeString(metadata.url) || parsed.url,
        },
        extra: {
          telegram: {
            authorAvatarUrl,
            authorId: normalizeString(metadata.authorId),
            authorName: normalizeString(metadata.authorName),
            authorUsername: normalizeString(metadata.authorUsername),
            chatAvatarUrl,
            chatTitle: normalizeString(metadata.chatTitle),
            chatType,
            chatUsername: normalizeString(metadata.chatUsername) ?? parsed.chatUsername,
            date: normalizeString(metadata.date),
            editedAt: normalizeString(metadata.editedAt),
            forwards: normalizeNumber(metadata.forwards),
            internalChatId: normalizeString(metadata.internalChatId) ?? parsed.internalChatId,
            messageId: normalizeString(metadata.messageId) ?? parsed.messageId,
            media,
            reactions,
            replies: normalizeNumber(metadata.replies),
            views: normalizeNumber(metadata.views),
          },
        },
        preview: {
          kind: "telegram_message",
          data: {
            authorAvatarUrl,
            authorId: normalizeString(metadata.authorId),
            authorName: normalizeString(metadata.authorName),
            authorUsername: normalizeString(metadata.authorUsername),
            avatarUrl: chatAvatarUrl,
            chatTitle: normalizeString(metadata.chatTitle),
            chatType,
            chatUsername: normalizeString(metadata.chatUsername) ?? parsed.chatUsername,
            date: normalizeString(metadata.date),
            editedAt: normalizeString(metadata.editedAt),
            forwards: normalizeNumber(metadata.forwards),
            media: getNormalizedResourceMedia(media),
            messageId: normalizeString(metadata.messageId) ?? parsed.messageId,
            reactions,
            replies: normalizeNumber(metadata.replies),
            text: description,
            url: normalizeString(metadata.permalink) || normalizeString(metadata.url) || parsed.url,
            views: normalizeNumber(metadata.views),
          },
        },
      },
    }
  },
}

function getNormalizedResourceMedia(media: TelegramMediaMetadata[]): ResourceMediaMetadata[] {
  const normalized: ResourceMediaMetadata[] = []

  for (const item of media) {
    const url = normalizeString(item.url)
    const thumbnailUrl = normalizeString(item.thumbnailUrl)
    const streamUrl = normalizeString(item.streamUrl)
    const mediaUrl = streamUrl || url
    if (!mediaUrl && !thumbnailUrl) continue

    normalized.push({
      kind: getResourceMediaKind(item),
      provider: "telegram",
      ...(normalizeString(item.messageId)
        ? { sourceId: normalizeString(item.messageId) }
        : {}),
      ...(mediaUrl ? { url: mediaUrl } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(normalizeString(item.mimeType)
        ? { mimeType: normalizeString(item.mimeType) }
        : {}),
      ...(normalizeString(item.fileName)
        ? { fileName: normalizeString(item.fileName) }
        : {}),
      ...(typeof item.size === "number" ? { size: item.size } : {}),
      ...(typeof item.width === "number" && item.width > 0
        ? { width: item.width }
        : {}),
      ...(typeof item.height === "number" && item.height > 0
        ? { height: item.height }
        : {}),
      ...(typeof item.duration === "number" && item.duration >= 0
        ? { duration: item.duration }
        : {}),
    })
  }

  return normalized
}

function getResourceMediaKind(item: TelegramMediaMetadata): ResourceMediaMetadata["kind"] {
  const type = normalizeString(item.type)
  const mimeType = normalizeString(item.mimeType)
  if (type === "photo" || mimeType?.startsWith("image/")) return "image"
  if (type === "video" || mimeType?.startsWith("video/")) return "video"
  if (type === "audio" || mimeType?.startsWith("audio/")) return "audio"
  if (type === "document") return "document"
  return "unknown"
}

async function fetchTelegramMetadata(input: {
  endpoint: string
  token?: string
  url: string
  resourceId: string
}): Promise<TelegramMetadataApiResponse> {
  const endpoint = new URL("/v1/telegram/metadata", normalizeEndpoint(input.endpoint))
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  })
  if (input.token) headers.set("authorization", `Bearer ${input.token}`)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        resourceId: input.resourceId,
        url: input.url,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const error = await readTelegramErrorResponse(response)
      return {
        ok: false,
        error:
          error ??
          `Telegram metadata service failed with HTTP ${response.status}.`,
      }
    }

    const payload = (await response.json()) as TelegramMetadataApiResponse
    return payload
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Telegram metadata service request failed.",
    }
  }
}

async function readTelegramErrorResponse(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim()
    }
  } catch {
    // Keep the generic HTTP status error if the service response is not JSON.
  }

  return undefined
}

async function persistTelegramMedia(
  media: TelegramMediaMetadata[],
  options: {
    resourceId: string
    persist?: (input: {
      resourceId: string
      url: string
      mediaType: string
      contentType?: string
      fileName?: string
      sourceId?: string
    }) => Promise<string | undefined>
  },
) {
  if (!options.persist) return media

  const persisted: TelegramMediaMetadata[] = []
  for (const item of media) {
    const next = { ...item }
    const mediaType = normalizeString(item.type) ?? "media"
    const isVideo = mediaType === "video" || normalizeString(item.mimeType)?.startsWith("video/")
    const shouldPersistUrl = !isVideo && normalizeString(item.url)
    const shouldPersistThumbnail = normalizeString(item.thumbnailUrl)
    const sourceId = normalizeString(item.messageId)

    if (shouldPersistUrl) {
      const url = await persistTelegramMediaItem(options.persist, {
        resourceId: options.resourceId,
        url: shouldPersistUrl,
        mediaType,
        contentType: normalizeString(item.mimeType),
        fileName: createTelegramMediaFileName(item, mediaType),
        sourceId,
      })
      if (url) next.url = url
    }

    if (shouldPersistThumbnail && shouldPersistThumbnail === shouldPersistUrl && next.url) {
      next.thumbnailUrl = next.url
    } else if (shouldPersistThumbnail) {
      const thumbnailUrl = await persistTelegramMediaItem(options.persist, {
        resourceId: options.resourceId,
        url: shouldPersistThumbnail,
        mediaType: `${mediaType}-thumbnail`,
        contentType: "image/jpeg",
        fileName: createTelegramMediaFileName(item, `${mediaType}-thumbnail`),
        sourceId,
      })
      if (thumbnailUrl) next.thumbnailUrl = thumbnailUrl
    }

    persisted.push(next)
  }

  return persisted
}

async function persistTelegramAvatar(input: {
  persist?: Parameters<typeof persistTelegramMedia>[1]["persist"]
  resourceId: string
  sourceId?: string
  url?: string
  mediaType: "author-avatar" | "chat-avatar"
}) {
  if (!input.persist || !input.url) return undefined

  return persistTelegramMediaItem(input.persist, {
    resourceId: input.resourceId,
    url: input.url,
    mediaType: input.mediaType,
    contentType: "image/jpeg",
    fileName: `${input.mediaType}.jpg`,
    sourceId: input.sourceId,
  })
}

async function persistTelegramMediaItem(
  persist: NonNullable<Parameters<typeof persistTelegramMedia>[1]["persist"]>,
  input: {
    resourceId: string
    url: string
    mediaType: string
    contentType?: string
    fileName?: string
    sourceId?: string
  },
) {
  try {
    return await persist(input)
  } catch (error) {
    console.warn("Telegram media persist failed", {
      mediaType: input.mediaType,
      sourceId: input.sourceId,
      message: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

function createTelegramMediaFileName(
  item: TelegramMediaMetadata,
  fallbackType: string,
) {
  const messageId = normalizeString(item.messageId)
  const fileName = normalizeString(item.fileName)
  if (messageId && fileName) return `${messageId}-${fileName}`
  if (fileName) return fileName
  if (messageId) return `${messageId}-${fallbackType}`
  return undefined
}

function normalizeEndpoint(value: string) {
  return value.endsWith("/") ? value : `${value}/`
}

function getTelegramTitle(
  metadata: TelegramMessageMetadata,
  parsed: NonNullable<ReturnType<typeof parseTelegramMessageLink>>,
) {
  const chatTitle =
    normalizeString(metadata.chatTitle) ||
    normalizeString(metadata.chatUsername) ||
    parsed.chatUsername ||
    "Telegram"
  const beijingTime = formatBeijingTime(normalizeString(metadata.date))

  return `${chatTitle} @telegram${beijingTime ? ` - ${beijingTime}` : ""}`
}

function getTelegramIdentifiers(parsed: NonNullable<ReturnType<typeof parseTelegramMessageLink>>) {
  return {
    messageId: parsed.messageId,
    ...(parsed.chatUsername ? { chatUsername: parsed.chatUsername } : {}),
    ...(parsed.internalChatId ? { internalChatId: parsed.internalChatId } : {}),
  }
}

function isTelegramMedia(value: TelegramMediaMetadata | null | undefined): value is TelegramMediaMetadata {
  return Boolean(value && normalizeString(value.type))
}

function normalizeString(value: unknown) {
  if (typeof value === "number") return String(value)
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function normalizeChatType(value: unknown) {
  return value === "channel" || value === "group" || value === "private"
    ? value
    : undefined
}

function normalizeReactions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const reaction = entry as TelegramReactionMetadata
    const emoji = normalizeString(reaction.emoji)
    const count = normalizeNumber(reaction.count)
    return emoji && typeof count === "number" ? [{ emoji, count }] : []
  })
}

function formatBeijingTime(value: string | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}
