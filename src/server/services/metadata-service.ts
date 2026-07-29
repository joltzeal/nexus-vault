import { and, eq, inArray, lt } from "drizzle-orm"

import { createDbSession } from "@/db"
import { resourceMetadata, resources } from "@/db/schema"
import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import type { Actor, ApiContext, Db } from "@/server/api/types"
import {
  createMetadataQueueMessage,
  type MetadataQueueMessage,
} from "@/server/metadata"
import {
  getMetadataProvider,
  isRetryableMetadataError,
} from "@/server/metadata/metadata-provider"
import {
  enqueueQueueMessage,
  hasQueueBinding,
  sendQueueMessageToEnv,
} from "@/server/queues/producer"
import { processNotificationMessage } from "@/server/services/notification-service"
import {
  getResourceOrThrow,
  requireResourceMutationPermission,
} from "@/server/services/resource-service"
import { getUserXComCookieString } from "@/server/services/account-integration-service"

const STALE_METADATA_RETRY_AFTER_MS = 2 * 60 * 1000
const STALE_METADATA_RETRY_LIMIT = 25

export function enqueueMetadataTask(
  c: ApiContext,
  message: MetadataQueueMessage
) {
  const queued = enqueueQueueMessage(c, message, { label: "Metadata" })

  if (!queued || shouldResolveMetadataInline(c.env)) {
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
    env?: CloudflareEnv
    retryTransient?: boolean
  } = {}
) {
  const resource = await getResourceOrThrow(db, resourceId)
  if (options.actor) {
    await requireResourceMutationPermission(db, resource, options.actor)
  }

  await db
    .update(resources)
    .set({
      metadataStatus: "processing",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(resources.id, resourceId))

  const provider = getMetadataProvider(resource)
  const twitterCookieString = resource.type === "twitter" && resource.createdBy
    ? await getUserXComCookieString(db, resource.createdBy)
    : undefined
  const result = await provider
    .resolve(resource, {
      twitterRequestProxyUrl: getTwitterRequestProxyUrl(options.env),
      twitterCookieString,
      captureHttpScreenshot: options.env
        ? (input) => captureHttpScreenshot(options.env, input)
        : undefined,
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
  const nextResourceTitle = shouldBackfillResourceTitle(resource.title, result.data.title)
    ? result.data.title
    : undefined
  const nextResourceDescription = shouldBackfillResourceDescription(
    resource.description,
    result.data.description
  )
    ? result.data.description
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
      dataJson: result.data as unknown as Record<string, unknown>,
      errorMessage: result.errorMessage,
    })
  })

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
    data: result.data,
  }
}

export async function processMetadataMessage(
  db: Db,
  message: MetadataQueueMessage,
  options: {
    env?: CloudflareEnv
  } = {}
) {
  if (message.kind !== "metadata.resolve") return
  await resolveResourceMetadata(db, message.resourceId, {
    ...options,
    retryTransient: true,
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

function getTwitterRequestProxyUrl(env?: CloudflareEnv) {
  return getRuntimeBinding(env, "TWITTER_REQUEST_PROXY_URL")
}

async function captureHttpScreenshot(
  env: CloudflareEnv | undefined,
  input: {
    resourceId: string
    title: string
    url: string
  }
) {
  if (!env?.MEDIA) {
    throw new Error("R2 MEDIA binding is not configured.")
  }

  const token = getRuntimeBinding(env, "BROWSERLESS_TOKEN")
  if (!token) {
    throw new Error("BROWSERLESS_TOKEN is not configured.")
  }

  const endpoint =
    getRuntimeBinding(env, "BROWSERLESS_SCREENSHOT_ENDPOINT") ??
    "https://production-sfo.browserless.io/screenshot"
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
        fullPage: true,
        type: "png",
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

function getRuntimeBinding(env: CloudflareEnv | undefined, name: string) {
  const bindings = env as (CloudflareEnv & Record<string, string | undefined>) | undefined
  return bindings?.[name]?.trim() || undefined
}

function shouldBackfillResourceTitle(currentTitle: string, metadataTitle?: string) {
  if (!metadataTitle) return false
  const normalizedCurrent = currentTitle.trim().toLowerCase()
  const normalizedNext = metadataTitle.trim().toLowerCase()

  return (
    normalizedNext.length > 0 &&
    normalizedNext !== normalizedCurrent &&
    ["名称未知", "untitled resource", "untitled link", "untitled tweet"].includes(
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
