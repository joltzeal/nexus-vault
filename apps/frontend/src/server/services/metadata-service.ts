import { eq } from "drizzle-orm"
import type { Context } from "hono"

import { createDbSession } from "@nexus-vault/db"
import { resourceMetadata, resources } from "@nexus-vault/db/schema"
import { createBaseResourceMetadata } from "@nexus-vault/shared/resource-metadata"
import { getMetadataProvider } from "@nexus-vault/providers"
import type { Actor, ApiEnv, Db } from "@/server/api/types"
import { processNotificationMessage } from "@/server/services/notification-service"
import type { MetadataQueueMessage } from "@/server/services/resource-service"
import {
  getResourceOrThrow,
  requireResourceMutationPermission,
} from "@/server/services/resource-service"

export function enqueueMetadataTask(
  c: Context<ApiEnv>,
  message: MetadataQueueMessage
) {
  c.executionCtx.waitUntil(sendMetadataQueueMessage(c, message))

  if (shouldResolveMetadataInline(c.env)) {
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
  } = {}
) {
  const resource = await getResourceOrThrow(db, resourceId)
  if (options.actor) {
    await requireResourceMutationPermission(db, resource, options.actor)
  }

  await db
    .update(resources)
    .set({ metadataStatus: "processing" })
    .where(eq(resources.id, resourceId))

  const provider = getMetadataProvider(resource)
  const result = await provider
    .resolve(resource, {
      twitterRequestProxyUrl: getTwitterRequestProxyUrl(options.env),
      twitterCookieString: getTwitterCookieString(options.env),
      captureHttpScreenshot: options.env
        ? (input) => captureHttpScreenshot(options.env, input)
        : undefined,
    })
    .catch((error: unknown) => ({
    provider: provider.name,
    status: "failed" as const,
    data: createBaseResourceMetadata({
      type: resource.type,
      title: resource.title,
    }),
    errorMessage: error instanceof Error ? error.message : "Metadata provider failed.",
    }))
  const nextResourceTitle = shouldBackfillResourceTitle(resource.title, result.data.title)
    ? result.data.title
    : undefined
  const nextResourceDescription = shouldBackfillResourceDescription(
    resource.description,
    result.data.description
  )
    ? result.data.description
    : undefined

  await db.batch([
    db
      .update(resources)
      .set({
        metadataStatus: result.status,
        ...(nextResourceTitle ? { title: nextResourceTitle } : {}),
        ...(nextResourceDescription ? { description: nextResourceDescription } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(resources.id, resourceId)),
    db.delete(resourceMetadata).where(eq(resourceMetadata.resourceId, resourceId)),
    db.insert(resourceMetadata).values({
      resourceId,
      provider: result.provider,
      status: result.status,
      dataJson: JSON.stringify(result.data),
      errorMessage: result.errorMessage,
    }),
  ])

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
  await resolveResourceMetadata(db, message.resourceId, options)
}

async function sendMetadataQueueMessage(c: Context<ApiEnv>, message: MetadataQueueMessage) {
  try {
    await c.env.METADATA_QUEUE.send(message)
  } catch (error) {
    console.error("Metadata queue enqueue failed", {
      resourceId: message.resourceId,
      error,
    })
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
  return env.NEXTJS_ENV === "development" || env.NEXTJS_ENV === "local"
}

function getTwitterRequestProxyUrl(env?: CloudflareEnv) {
  return getRuntimeBinding(env, "TWITTER_REQUEST_PROXY_URL")
}

function getTwitterCookieString(env?: CloudflareEnv) {
  return getRuntimeBinding(env, "TWITTER_COOKIE_STRING")
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
