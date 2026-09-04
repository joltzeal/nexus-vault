import { and, eq, inArray, lt } from "drizzle-orm"

import { createDbSession } from "../db/index"
import { resourceMetadata, resources } from "../db/schema"
import { LOCAL_MEDIA_PROVIDER } from "../domain/media-storage"
import {
  createBaseResourceMetadata,
  normalizeResourceMetadata,
} from "../domain/resources/metadata"
import type { Actor, ApiContext, Db } from "../types/legacy-api"
import {
  createMetadataQueueMessage,
  type MetadataQueueMessage,
} from "../metadata/index"
import {
  getMetadataProvider,
  isRetryableMetadataError,
} from "../metadata/metadata-provider"
import {
  enqueueQueueMessage,
  hasQueueBinding,
  sendQueueMessageToEnv,
} from "../queues/producer"
import { processNotificationMessage } from "./notification-service"
import {
  getResourceOrThrow,
  requireResourceMutationPermission,
} from "./resource-service"
import { ApiError, conflict } from "../lib/errors"
import { getUserXComCookieString } from "./account-integration-service"
import {
  createResourceAiSummaryQueueMessage,
  markResourceAiSummaryPending,
  processResourceAiSummaryMessage,
  shouldGenerateResourceAiSummary,
} from "./resource-ai-summary-service"

const STALE_METADATA_RETRY_AFTER_MS = 5 * 60 * 1000
const STALE_METADATA_RETRY_LIMIT = 25
const MAGNET_MEDIA_RETRY_PREFIX = "magnet-media-retry:v1:"
const MAGNET_MEDIA_RETRY_TTL_SECONDS = 90 * 24 * 60 * 60
const MAGNET_MEDIA_RETRY_MAX_ITEMS_PER_RUN = 50
const MAGNET_MEDIA_RETRY_INITIAL_DELAY_MS = 5 * 60 * 1000
const MAGNET_MEDIA_RETRY_MAX_DELAY_MS = 24 * 60 * 60 * 1000
const MAGNET_MEDIA_FETCH_MAX_ATTEMPTS = 3
const MAGNET_MEDIA_FETCH_RETRY_DELAYS_MS = [500, 1500]

export function enqueueMetadataTask(
  c: ApiContext,
  message: MetadataQueueMessage
) {
  if (shouldResolveMetadataInline(c.env)) {
    c.executionCtx.waitUntil(resolveInlineMetadata(c.env, message.resourceId))
    return
  }

  const queued = enqueueQueueMessage(c, message, { label: "Metadata" })

  if (!queued) {
    c.executionCtx.waitUntil(
      resolveInlineMetadata(c.env, message.resourceId)
    )
  }
}

export async function resolveResourceMetadata(
  db: Db,
  resourceId: string,
  options: {
    actor?: Actor
    env: CloudflareEnv
    retryTransient?: boolean
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  if (options.actor) {
    await requireResourceMutationPermission(db, resource, options.actor)
  }
  const [currentMetadata] = await db
    .select({
      dataJson: resourceMetadata.dataJson,
      provider: resourceMetadata.provider,
    })
    .from(resourceMetadata)
    .where(eq(resourceMetadata.resourceId, resourceId))
    .limit(1)

  if (currentMetadata?.provider === LOCAL_MEDIA_PROVIDER || !resource.url) {
    throw conflict("本地上传媒体不需要重新获取 metadata。")
  }

  const twitterCookieUserId = options.actor?.id ?? resource.createdBy
  const twitterCookieString = resource.type === "twitter" && twitterCookieUserId
    ? await getUserXComCookieString(db, twitterCookieUserId)
    : undefined
  if (resource.type === "twitter" && options.actor && !twitterCookieString) {
    throw new ApiError(
      "X_COM_COOKIE_REQUIRED",
      "请先在 Settings > Integrations 中配置自己的 x.com Cookie。",
      422,
    )
  }

  await db
    .update(resources)
    .set({
      metadataStatus: "processing",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resources.id, resourceId))

  const metadataResource = { ...resource, url: resource.url }
  const provider = getMetadataProvider(metadataResource)
  const result = resource.type === "twitter" && !twitterCookieString
    ? {
        provider: provider.name,
        status: "failed" as const,
        data: createBaseResourceMetadata({
          type: resource.type,
          title: resource.title,
        }),
        errorMessage: "资源创建者尚未配置自己的 x.com Cookie。",
      }
    : await provider
        .resolve(metadataResource, {
          retryTransient: options.retryTransient,
          twitterCookieString,
          githubToken: getRuntimeBinding(options.env, "GITHUB_TOKEN"),
          gofileApiToken: getRuntimeBinding(options.env, "GOFILE_TOKEN") ?? getRuntimeBinding(options.env, "GOFILE_API_TOKEN"),
          gofileCache: options.env.CACHE,
          tikhubApiToken: getTikhubApiToken(options.env),
          telegramMetadataApiUrl: getTelegramMetadataApiUrl(options.env),
          telegramMetadataApiToken: getTelegramMetadataApiToken(options.env),
          persistTelegramMedia: (input) => persistTelegramMedia(options.env, input),
          persistMagnetScreenshot: (input) => persistMagnetScreenshot(options.env, input),
          magnetCache: options.env.CACHE,
          captureHttpScreenshot: (input) => captureHttpScreenshot(options.env, input),
        })
        .catch((error: unknown) => {
          if (options.retryTransient && isRetryableMetadataError(error)) {
            throw error
          }

          return {
            provider: provider.name,
            status: "failed" as const,
            data: createBaseResourceMetadata({
              type: resource.type,
              title: resource.title,
            }),
            errorMessage:
              error instanceof Error ? error.message : "Metadata provider failed.",
          }
        })
  const previousMetadata = normalizeResourceMetadata(currentMetadata?.dataJson)
  const previousAiSummary = getPersistedAiSummaryText(previousMetadata?.extra?.aiSummary)
  const aiSummaryRequested = shouldGenerateResourceAiSummary({
    currentDescription:
      previousAiSummary && previousAiSummary === resource.description.trim()
        ? ""
        : resource.description,
    data: result.data,
    env: options.env,
    provider: result.provider,
    status: result.status,
    type: resource.type,
  })
  const resolvedData = aiSummaryRequested
    ? markResourceAiSummaryPending(result.data, options.env)
    : result.data
  const nextResourceTitle = shouldBackfillResourceTitle(resource.title, resolvedData.title)
    ? resolvedData.title
    : undefined
  const nextResourceDescription = shouldBackfillResourceDescription(
    resource.description,
    resolvedData.description
  )
    ? resolvedData.description
    : undefined

  await db.transaction(async (tx) => {
    await tx
      .update(resources)
      .set({
        metadataStatus: result.status,
        ...(nextResourceTitle ? { title: nextResourceTitle } : {}),
        ...(nextResourceDescription ? { description: nextResourceDescription } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(resources.id, resourceId))
    await tx.delete(resourceMetadata).where(eq(resourceMetadata.resourceId, resourceId))
    await tx.insert(resourceMetadata).values({
      resourceId,
      provider: result.provider,
      status: result.status,
      dataJson: resolvedData as unknown as Record<string, unknown>,
      errorMessage: result.errorMessage,
    })
  })

  if (aiSummaryRequested) {
    const message = createResourceAiSummaryQueueMessage(resourceId, resource.vaultId)
    if (shouldResolveMetadataInline(options.env)) {
      await processResourceAiSummaryMessage(db, message, {
        env: options.env,
        retryTransient: false,
      })
    } else {
      const queued = await sendQueueMessageToEnv(options.env, message, {
        delaySeconds: 2,
        label: "AI summary",
      })
      if (!queued && options.env) {
        await processResourceAiSummaryMessage(db, message, {
          env: options.env,
          retryTransient: false,
        })
      }
    }
  }

  if (resource.createdBy && result.status === "failed") {
    await processNotificationMessage(db, {
      kind: "notification.create",
      userId: resource.createdBy,
      vaultId: resource.vaultId,
      type: "metadata.failed",
      title: "资源 metadata 处理失败",
      body: result.data.title ?? resource.title,
      requestedAt: new Date().toISOString(),
    })
  }

  return {
    status: result.status,
    provider: result.provider,
    data: resolvedData,
  }
}

async function persistMagnetScreenshot(
  env: CloudflareEnv,
  input: { url: string; sourceId: string },
) {
  if (!env.MEDIA) throw new Error("R2 MEDIA binding is not configured.")
  const sourceUrl = new URL(input.url)
  if (sourceUrl.hostname.toLowerCase() !== "whatslink.info" || !/^\/image\/[a-z0-9]+$/i.test(sourceUrl.pathname)) {
    throw new Error("Invalid whatslink screenshot URL.")
  }
  const id = input.sourceId.replace(/[^a-z0-9_-]/gi, "")
  if (!id) throw new Error("Invalid whatslink screenshot ID.")
  const key = `whatslink/${id}.png`

  try {
    const existing = await env.MEDIA.head(key)
    if (existing) {
      await clearMagnetScreenshotRetry(env, id)
      return `/api/v1/media/${key}`
    }

    const image = await fetchMagnetScreenshotWithRetry(sourceUrl.toString())
    await env.MEDIA.put(key, image, {
      httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { provider: "whatslink", sourceId: id, sourceUrl: sourceUrl.toString() },
    })
    await clearMagnetScreenshotRetry(env, id)
    return `/api/v1/media/${key}`
  } catch (error) {
    await scheduleMagnetScreenshotRetry(env, {
      url: sourceUrl.toString(),
      sourceId: id,
      error,
    })
    throw error
  }
}

async function fetchMagnetScreenshotWithRetry(url: string) {
  let lastError: unknown
  for (let attempt = 0; attempt < MAGNET_MEDIA_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "image/*" },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        const error = new Error(`Whatslink screenshot failed with HTTP ${response.status}.`)
        if (!isTransientMediaStatus(response.status)) throw error
        error.name = "RetryableMediaError"
        throw error
      }
      const image = await response.arrayBuffer()
      if (image.byteLength === 0) {
        const error = new Error("Whatslink screenshot is empty.")
        error.name = "RetryableMediaError"
        throw error
      }
      return image
    } catch (error) {
      lastError = error
      if (!isTransientMediaError(error) || attempt === MAGNET_MEDIA_FETCH_MAX_ATTEMPTS - 1) {
        throw error
      }
      const delay = MAGNET_MEDIA_FETCH_RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await wait(delay)
    }
  }
  throw lastError ?? new Error("Whatslink screenshot download failed.")
}

export async function runScheduledMagnetMediaRetries(env: CloudflareEnv) {
  if (!env.CACHE || !env.MEDIA) {
    return { candidates: 0, attempted: 0, completed: 0 }
  }

  const session = await createDbSession(env)
  try {
    const listed = await env.CACHE.list({
      prefix: MAGNET_MEDIA_RETRY_PREFIX,
      limit: MAGNET_MEDIA_RETRY_MAX_ITEMS_PER_RUN,
    })
    const now = Date.now()
    let attempted = 0
    let completed = 0

    for (const key of listed.keys) {
      const retry = await readMagnetScreenshotRetry(env, key.name)
      if (!retry || retry.nextAttemptAt > now) continue

      attempted += 1
      try {
        const persistedUrl = await persistMagnetScreenshot(env, {
          url: retry.url,
          sourceId: retry.sourceId,
        })
        await updateMagnetMediaReferences(session.db, {
          sourceId: retry.sourceId,
          sourceUrl: retry.url,
          persistedUrl,
        })
        completed += 1
      } catch (error) {
        console.warn("Scheduled Whatslink screenshot retry failed", {
          sourceId: retry.sourceId,
          attempts: retry.attempts,
          error,
        })
      }
    }

    return {
      candidates: listed.keys.length,
      attempted,
      completed,
    }
  } finally {
    await session.close()
  }
}

async function updateMagnetMediaReferences(
  db: Db,
  input: { sourceId: string; sourceUrl: string; persistedUrl: string },
) {
  const rows = await db
    .select({
      resourceId: resourceMetadata.resourceId,
      dataJson: resourceMetadata.dataJson,
    })
    .from(resourceMetadata)
    .innerJoin(resources, eq(resources.id, resourceMetadata.resourceId))
    .where(eq(resources.type, "magnet"))
    .limit(5_000)

  for (const row of rows) {
    const metadata = normalizeResourceMetadata(row.dataJson)
    if (!metadata?.media?.length) continue

    let changed = false
    const media = metadata.media.map((item) => {
      const isTarget =
        item.sourceId === input.sourceId ||
        (item.sourceUrl === input.sourceUrl && item.url === input.sourceUrl)
      if (!isTarget) return item

      changed = true
      return {
        ...item,
        url: input.persistedUrl,
        ...(item.thumbnailUrl === item.url
          ? { thumbnailUrl: input.persistedUrl }
          : {}),
      }
    })
    if (!changed) continue

    await db
      .update(resourceMetadata)
      .set({ dataJson: { ...metadata, media } as Record<string, unknown> })
      .where(eq(resourceMetadata.resourceId, row.resourceId))
  }
}

type MagnetScreenshotRetry = {
  version: 1
  url: string
  sourceId: string
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

async function scheduleMagnetScreenshotRetry(
  env: CloudflareEnv,
  input: { url: string; sourceId: string; error: unknown },
) {
  if (!env.CACHE) return

  const key = `${MAGNET_MEDIA_RETRY_PREFIX}${input.sourceId}`
  try {
    const previous = await readMagnetScreenshotRetry(env, key)
    const attempts = (previous?.attempts ?? 0) + 1
    const delay = Math.min(
      MAGNET_MEDIA_RETRY_MAX_DELAY_MS,
      MAGNET_MEDIA_RETRY_INITIAL_DELAY_MS * 2 ** Math.min(attempts - 1, 8),
    )
    const value: MagnetScreenshotRetry = {
      version: 1,
      url: input.url,
      sourceId: input.sourceId,
      attempts,
      nextAttemptAt: Date.now() + delay,
      lastError: errorMessage(input.error),
    }
    await env.CACHE.put(key, JSON.stringify(value), {
      expirationTtl: MAGNET_MEDIA_RETRY_TTL_SECONDS,
    })
  } catch (error) {
    console.warn("Failed to schedule Whatslink screenshot retry", {
      sourceId: input.sourceId,
      error,
    })
  }
}

async function readMagnetScreenshotRetry(env: CloudflareEnv, key: string) {
  if (!env.CACHE) return null
  try {
    const value = await env.CACHE.get(key, "json")
    if (!isRecord(value)) return null
    if (
      value.version !== 1 ||
      typeof value.url !== "string" ||
      typeof value.sourceId !== "string" ||
      !Number.isInteger(value.attempts) ||
      !Number.isFinite(value.nextAttemptAt)
    ) {
      return null
    }
    return value as unknown as MagnetScreenshotRetry
  } catch (error) {
    console.warn("Failed to read Whatslink screenshot retry", { key, error })
    return null
  }
}

async function clearMagnetScreenshotRetry(env: CloudflareEnv, sourceId: string) {
  if (!env.CACHE) return
  await env.CACHE.delete(`${MAGNET_MEDIA_RETRY_PREFIX}${sourceId}`).catch((error) => {
    console.warn("Failed to clear Whatslink screenshot retry", { sourceId, error })
  })
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Image download failed."
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isTransientMediaStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function isTransientMediaError(error: unknown) {
  if (!(error instanceof Error)) return false
  return (
    error.name === "RetryableMediaError" ||
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError ||
    /\b(timeout|timed out|network|fetch|econn|enotfound|eai_again)\b/i.test(error.message)
  )
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function processMetadataMessage(
  db: Db,
  message: MetadataQueueMessage,
  options: {
    env: CloudflareEnv
    retryTransient?: boolean
  }
) {
  if (message.kind !== "metadata.resolve") return
  await resolveResourceMetadata(db, message.resourceId, {
    ...options,
    retryTransient: options.retryTransient ?? true,
  })
}

export async function enqueueStaleMetadataTasks(db: Db, env: CloudflareEnv) {
  const now = new Date()
  const nowIso = now.toISOString()
  const cutoffIso = new Date(now.getTime() - STALE_METADATA_RETRY_AFTER_MS).toISOString()
  const staleResources = await db
    .select({
      id: resources.id,
      vaultId: resources.vaultId,
      type: resources.type,
      url: resources.url,
    })
    .from(resources)
    .where(
      and(
        inArray(resources.metadataStatus, ["pending", "processing"]),
        lt(resources.updatedAt, cutoffIso)
      )
    )
    .limit(STALE_METADATA_RETRY_LIMIT)

  for (const resource of staleResources) {
    if (!resource.url) continue

    await db.transaction(async (tx) => {
      await tx
        .update(resources)
        .set({
          metadataStatus: "pending",
          updatedAt: nowIso,
        })
        .where(eq(resources.id, resource.id))
      await tx
        .update(resourceMetadata)
        .set({
          status: "pending",
          errorMessage: null,
          updatedAt: nowIso,
        })
        .where(eq(resourceMetadata.resourceId, resource.id))
    })
    const message = createMetadataQueueMessage(
      resource.vaultId,
      resource.id,
      resource.type,
      resource.url
    )

    if (hasQueueBinding(env)) {
      await sendQueueMessageToEnv(env, message, { label: "Metadata" })
    } else {
      await resolveResourceMetadata(db, resource.id, { env })
    }
  }

  return {
    queued: staleResources.length,
  }
}

async function resolveInlineMetadata(env: CloudflareEnv, resourceId: string) {
  const session = await createDbSession(env)

  try {
    await resolveResourceMetadata(session.db, resourceId, { env })
  } finally {
    await session.close()
  }
}

function shouldResolveMetadataInline(env: CloudflareEnv) {
  return (
    getRuntimeBinding(env, "METADATA_RESOLVE_INLINE") === "true" ||
    env.NEXTJS_ENV === "development" ||
    env.NEXTJS_ENV === "local"
  )
}

function getTelegramMetadataApiUrl(env: CloudflareEnv) {
  return getRuntimeBinding(env, "TELEGRAM_METADATA_API_URL")
}

function getTelegramMetadataApiToken(env: CloudflareEnv) {
  return getRuntimeBinding(env, "TELEGRAM_METADATA_API_TOKEN")
}

function getTikhubApiToken(env: CloudflareEnv) {
  return getRuntimeBinding(env, "TIKHUB_API_TOKEN")
}

async function captureHttpScreenshot(
  env: CloudflareEnv,
  input: {
    resourceId: string
    title: string
    url: string
  }
) {
  if (!env.MEDIA) {
    throw new Error("R2 MEDIA binding is not configured.")
  }

  const token = getRuntimeBinding(env, "BROWSERLESS_TOKEN")
  if (!token) {
    throw new Error("BROWSERLESS_TOKEN is not configured.")
  }

  const configuredEndpoint = getRuntimeBinding(env, "BROWSERLESS_SCREENSHOT_ENDPOINT")
  const endpoint =
    configuredEndpoint && !configuredEndpoint.includes("...")
      ? configuredEndpoint
      : "https://production-sfo.browserless.io/screenshot"
  const screenshotUrl = new URL(endpoint)
  screenshotUrl.searchParams.set("token", token)

  const response = await fetch(screenshotUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url: input.url,
      options: {
        fullPage: false,
        type: "png",
      },
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
      waitForTimeout: 5000,
      // blockAds: true,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`Browserless screenshot failed with HTTP ${response.status}.`)
  }

  const image = await response.arrayBuffer()
  if (image.byteLength === 0) {
    throw new Error("Browserless screenshot returned an empty image.")
  }

  const key = `screenshots/${input.resourceId}/${Date.now()}.png`
  await env.MEDIA.put(key, image, {
    httpMetadata: {
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      resourceId: input.resourceId,
      sourceUrl: input.url,
      title: input.title.slice(0, 256),
    },
  })

  return `/api/v1/media/${key}`
}

async function persistTelegramMedia(
  env: CloudflareEnv,
  input: {
    resourceId: string
    url: string
    mediaType: string
    contentType?: string
    fileName?: string
    sourceId?: string
  }
) {
  if (!env.MEDIA) {
    throw new Error("R2 MEDIA binding is not configured.")
  }

  const mediaFetchUrl = getTelegramServiceFetchUrl(env, input.url)
  const response = await fetch(mediaFetchUrl, {
    headers: {
      ...(getTelegramMetadataApiToken(env)
        ? { authorization: `Bearer ${getTelegramMetadataApiToken(env)}` }
        : {}),
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`Telegram media fetch failed with HTTP ${response.status}.`)
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10)
  const maxBytes = getTelegramMediaMaxBytes(env)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Telegram media is larger than ${maxBytes} bytes.`)
  }

  const media = await response.arrayBuffer()
  if (media.byteLength === 0) {
    throw new Error("Telegram media fetch returned an empty response.")
  }
  if (media.byteLength > maxBytes) {
    throw new Error(`Telegram media is larger than ${maxBytes} bytes.`)
  }

  const contentType =
    response.headers.get("content-type") ??
    input.contentType ??
    "application/octet-stream"
  const key = `telegram/${input.resourceId}/${Date.now()}-${crypto.randomUUID()}-${createSafeMediaFileName(
    input.mediaType,
    input.fileName,
    contentType,
  )}`
  await env.MEDIA.put(key, media, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      resourceId: input.resourceId,
      sourceUrl: mediaFetchUrl.slice(0, 512),
      sourceId: input.sourceId?.slice(0, 128) ?? "",
      mediaType: input.mediaType.slice(0, 64),
    },
  })

  return `/api/v1/media/${key}`
}

function getTelegramServiceFetchUrl(env: CloudflareEnv, value: string) {
  const endpoint = getTelegramMetadataApiUrl(env)
  if (!endpoint) return value

  try {
    const mediaUrl = new URL(value)
    const serviceUrl = new URL(endpoint)
    serviceUrl.pathname = mediaUrl.pathname
    serviceUrl.search = mediaUrl.search
    serviceUrl.hash = mediaUrl.hash
    return serviceUrl.toString()
  } catch {
    return value
  }
}

function getTelegramMediaMaxBytes(env: CloudflareEnv) {
  const value = getRuntimeBinding(env, "TELEGRAM_MEDIA_MAX_BYTES")
  if (!value) return 20 * 1024 * 1024
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 1024 * 1024
}

function createSafeMediaFileName(
  mediaType: string,
  fileName: string | undefined,
  contentType: string,
) {
  const safeName = fileName
    ?.split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80)
  if (safeName) return safeName

  return `${mediaType.replace(/[^a-zA-Z0-9_-]/g, "-")}.${getMediaExtension(contentType)}`
}

function getMediaExtension(contentType: string) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase()
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/gif") return "gif"
  return "bin"
}

function getRuntimeBinding(env: CloudflareEnv, name: string) {
  const bindings = env as CloudflareEnv & Record<string, string | undefined>
  return bindings[name]?.trim() || undefined
}

function shouldBackfillResourceTitle(currentTitle: string, metadataTitle?: string) {
  if (!metadataTitle) return false
  const normalizedCurrent = currentTitle.trim().toLowerCase()
  const normalizedNext = metadataTitle.trim().toLowerCase()

  return (
    normalizedNext.length > 0 &&
    normalizedNext !== normalizedCurrent &&
    ["名称未知", "untitled resource", "untitled link", "untitled tweet", "抖音视频", "gofile folder"].includes(
      normalizedCurrent
    )
  )
}

function shouldBackfillResourceDescription(
  currentDescription: string,
  metadataDescription?: string
) {
  return !currentDescription.trim() && Boolean(metadataDescription?.trim())
}

function getPersistedAiSummaryText(value: unknown) {
  if (!value || typeof value !== "object") return ""
  const text = (value as Record<string, unknown>).text
  return typeof text === "string" ? text.trim() : ""
}
