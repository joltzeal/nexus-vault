import { and, asc, eq, inArray, sql } from "drizzle-orm"

import { createDbSession } from "../db/index"
import { resourceMetadata, resources } from "../db/schema"
import type { ResourceType } from "../domain/resources/types"
import type { Db } from "../types/legacy-api"
import { resolveResourceMetadata } from "./metadata-service"

const DEFAULT_DAILY_CHECK_LIMIT = 1000
const CHECK_STALE_AFTER_MS = 20 * 60 * 60 * 1000
const QUEUE_BATCH_SIZE = 100

export type CloudDriveCheckProvider = Extract<ResourceType, "baidu_pan" | "xunlei_pan">

export type CloudDriveCheckQueueMessage = {
  kind: "cloud-drive.check"
  provider: CloudDriveCheckProvider
  resourceId: string
  vaultId: string
  requestedAt: string
}

export function isCloudDriveCheckQueueMessage(
  message: unknown
): message is CloudDriveCheckQueueMessage {
  if (!isRecord(message)) return false

  return (
    message.kind === "cloud-drive.check" &&
    (message.provider === "baidu_pan" || message.provider === "xunlei_pan") &&
    typeof message.resourceId === "string" &&
    typeof message.vaultId === "string" &&
    typeof message.requestedAt === "string"
  )
}

export async function enqueueDailyCloudDriveCheckTasks(
  db: Db,
  env: CloudflareEnv
) {
  const resourcesToCheck = await getCloudDriveResourcesToCheck(
    db,
    getCloudDriveCheckLimit(env)
  )
  const messages = resourcesToCheck.map((resource) =>
    createCloudDriveCheckQueueMessage({
      provider: resource.type as CloudDriveCheckProvider,
      resourceId: resource.id,
      vaultId: resource.vaultId,
    })
  )

  const queued = await sendCloudDriveCheckBatch(env, messages)

  return {
    candidates: resourcesToCheck.length,
    queued,
  }
}

export async function processCloudDriveCheckMessage(
  db: Db,
  message: CloudDriveCheckQueueMessage,
  options: {
    env: CloudflareEnv
  }
) {
  if (await shouldSkipCloudDriveCheck(db, message.resourceId, message.provider)) {
    return { skipped: true }
  }

  await resolveResourceMetadata(db, message.resourceId, {
    env: options.env,
    retryTransient: true,
  })

  return { skipped: false }
}

export async function runScheduledCloudDriveChecks(
  env: CloudflareEnv,
  input: {
    cron?: string
    scheduledTime?: number
  } = {}
) {
  const session = await createDbSession(env)

  try {
    const result = await enqueueDailyCloudDriveCheckTasks(session.db, env)
    console.log("Cloud drive availability check scheduled", {
      cron: input.cron,
      scheduledTime: input.scheduledTime,
      ...result,
    })
    return result
  } finally {
    await session.close()
  }
}

async function getCloudDriveResourcesToCheck(db: Db, limit: number) {
  const checkedAt = cloudDriveAvailabilityCheckedAtSql()
  const cutoffIso = new Date(Date.now() - CHECK_STALE_AFTER_MS).toISOString()

  return db
    .select({
      id: resources.id,
      vaultId: resources.vaultId,
      type: resources.type,
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(
      and(
        inArray(resources.type, ["baidu_pan", "xunlei_pan"]),
        sql`coalesce(${cloudDriveAvailabilityStatusSql()}, '') <> 'unavailable'`,
        sql`(${checkedAt} is null or ${checkedAt} < ${cutoffIso})`
      )
    )
    .orderBy(asc(checkedAt), asc(resources.updatedAt))
    .limit(limit)
}

async function shouldSkipCloudDriveCheck(
  db: Db,
  resourceId: string,
  provider: CloudDriveCheckProvider
) {
  const [resource] = await db
    .select({
      id: resources.id,
      type: resources.type,
      availabilityStatus: cloudDriveAvailabilityStatusSql(),
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(eq(resources.id, resourceId))
    .limit(1)

  return (
    !resource ||
    resource.type !== provider ||
    resource.availabilityStatus === "unavailable"
  )
}

function createCloudDriveCheckQueueMessage(input: {
  provider: CloudDriveCheckProvider
  resourceId: string
  vaultId: string
}): CloudDriveCheckQueueMessage {
  return {
    kind: "cloud-drive.check",
    provider: input.provider,
    resourceId: input.resourceId,
    vaultId: input.vaultId,
    requestedAt: new Date().toISOString(),
  }
}

async function sendCloudDriveCheckBatch(
  env: CloudflareEnv,
  messages: CloudDriveCheckQueueMessage[]
) {
  const queue = getCloudDriveCheckQueue(env)
  if (!queue || messages.length === 0) return 0

  let queued = 0
  for (let index = 0; index < messages.length; index += QUEUE_BATCH_SIZE) {
    const batch = messages
      .slice(index, index + QUEUE_BATCH_SIZE)
      .map((body) => ({
        body,
        contentType: "json" as const,
      }))

    await queue.sendBatch(batch)
    queued += batch.length
  }

  return queued
}

function getCloudDriveCheckQueue(env: CloudflareEnv) {
  return (env as CloudflareEnv & {
    CLOUD_DRIVE_CHECK_QUEUE?: Queue<CloudDriveCheckQueueMessage>
  }).CLOUD_DRIVE_CHECK_QUEUE
}

function getCloudDriveCheckLimit(env: CloudflareEnv) {
  const configured = Number(
    (env as CloudflareEnv & { CLOUD_DRIVE_CHECK_DAILY_LIMIT?: string })
      .CLOUD_DRIVE_CHECK_DAILY_LIMIT
  )

  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, 10_000)
  }

  return DEFAULT_DAILY_CHECK_LIMIT
}

function cloudDriveAvailabilityStatusSql() {
  return sql<string | null>`${resourceMetadata.dataJson} #>> '{extra,cloudDrive,availability,status}'`
}

function cloudDriveAvailabilityCheckedAtSql() {
  return sql<string | null>`${resourceMetadata.dataJson} #>> '{extra,cloudDrive,availability,checkedAt}'`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
