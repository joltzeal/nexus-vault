import { and, desc, eq, isNull } from "drizzle-orm"

import { resourceMetadata, resources, resourceSubmissions } from "@/db/schema"
import { parseResourceInput, type ResourceType } from "@/domain/resources/input"
import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import { conflict, forbidden, notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import { createMetadataQueueMessage } from "@/server/metadata"
import { getMetadataProvider } from "@/server/metadata/metadata-provider"
import { ensureEditorCollaborator } from "@/server/services/collaborator-service"
import type { NotificationQueueMessage } from "@/server/services/notification-service"
import { requireVaultPermission } from "@/server/services/permission-service"
import {
  ensureResourceUrlNotDuplicate,
  getDuplicateResourceKey,
} from "@/server/services/resource-service"
import { getDefaultSpaceId, getSpaceInVaultOrThrow } from "@/server/services/space-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export type ResourceSubmissionStatus = "pending" | "approved" | "rejected"

export async function createResourceSubmission(
  db: Db,
  vaultId: string,
  input: {
    spaceId?: string
    type?: ResourceType
    title?: string
    description: string
    url: string
    actor?: Actor
    env?: CloudflareEnv
  }
) {
  const vault = await getVaultOrThrow(db, vaultId)
  if (vault.visibility === "private" || !vault.collectionEnabled) {
    throw forbidden("This vault is not accepting submissions.")
  }

  const spaceId = input.spaceId
    ? (await getSpaceInVaultOrThrow(db, vaultId, input.spaceId)).id
    : null
  const parsed = parseResourceInput({
    url: input.url,
    type: input.type,
    title: input.title,
  })
  const dedupeKey = getDuplicateResourceKey(parsed.url)
  await ensureResourceUrlNotDuplicate(db, vaultId, dedupeKey)
  const submitterId = input.actor ? await ensureActorUser(db, input.actor) : null
  const submissionId = newId()
  const now = new Date().toISOString()
  const metadata = await resolveSubmissionMetadata({
    id: submissionId,
    vaultId,
    spaceId,
    submitterId,
    type: parsed.type,
    title: parsed.title,
    description: input.description,
    url: parsed.url,
    now,
    env: input.env,
  })

  await db.insert(resourceSubmissions).values({
    id: submissionId,
    vaultId,
    spaceId,
    submitterId,
    submitterName: input.actor?.name ?? "",
    submitterEmail: input.actor?.email ?? "",
    type: parsed.type,
    title: parsed.title,
    description: input.description,
    url: parsed.url,
    metadataJson: metadata as unknown as Record<string, unknown>,
  })

  const notificationTask: NotificationQueueMessage | null =
    vault.ownerId && vault.ownerId !== submitterId
      ? {
          kind: "notification.create",
          userId: vault.ownerId,
          vaultId,
          type: "resource_submission.created",
          title: "有新的资源提交",
          body: parsed.title || parsed.url,
          requestedAt: new Date().toISOString(),
        }
      : null

  return { id: submissionId, status: "pending" as const, notificationTask }
}

async function resolveSubmissionMetadata(input: {
  id: string
  vaultId: string
  spaceId: string | null
  submitterId: string | null
  type: ResourceType
  title: string
  description: string
  url: string
  now: string
  env?: CloudflareEnv
}) {
  const resource = {
    id: input.id,
    vaultId: input.vaultId,
    spaceId: input.spaceId,
    type: input.type,
    title: input.title,
    description: input.description,
    url: input.url,
    dedupeKey: getDuplicateResourceKey(input.url),
    metadataStatus: "pending" as const,
    position: 0,
    createdBy: input.submitterId,
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null,
  }
  const provider = getMetadataProvider(resource)
  const result = await provider
    .resolve(resource, {
      fetchHttpPage: false,
      probeCloudDriveAvailability: false,
      twitterRequestProxyUrl: getRuntimeBinding(input.env, "TWITTER_REQUEST_PROXY_URL"),
      twitterCookieString: getRuntimeBinding(input.env, "TWITTER_COOKIE_STRING"),
    })
    .catch(() => ({
      provider: provider.name,
      status: "failed" as const,
      data: createBaseResourceMetadata({
        type: input.type,
        title: input.title,
      }),
    }))

  return result.data
}

function getRuntimeBinding(env: CloudflareEnv | undefined, name: string) {
  const bindings = env as (CloudflareEnv & Record<string, string | undefined>) | undefined
  return bindings?.[name]?.trim() || undefined
}

export async function listResourceSubmissions(
  db: Db,
  vaultId: string,
  input: {
    status?: ResourceSubmissionStatus
    actor: Actor
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "vault:update",
  })

  return db
    .select({
      id: resourceSubmissions.id,
      vaultId: resourceSubmissions.vaultId,
      spaceId: resourceSubmissions.spaceId,
      status: resourceSubmissions.status,
      submitterName: resourceSubmissions.submitterName,
      submitterEmail: resourceSubmissions.submitterEmail,
      type: resourceSubmissions.type,
      title: resourceSubmissions.title,
      description: resourceSubmissions.description,
      url: resourceSubmissions.url,
      metadataJson: resourceSubmissions.metadataJson,
      reviewNote: resourceSubmissions.reviewNote,
      reviewedAt: resourceSubmissions.reviewedAt,
      approvedResourceId: resourceSubmissions.approvedResourceId,
      createdAt: resourceSubmissions.createdAt,
      updatedAt: resourceSubmissions.updatedAt,
    })
    .from(resourceSubmissions)
    .where(
      and(
        eq(resourceSubmissions.vaultId, vaultId),
        input.status ? eq(resourceSubmissions.status, input.status) : undefined,
        isNull(resourceSubmissions.deletedAt)
      )
    )
    .orderBy(desc(resourceSubmissions.createdAt))
    .limit(100)
}

export async function approveResourceSubmission(
  db: Db,
  vaultId: string,
  submissionId: string,
  input: {
    spaceId?: string
    note?: string
    actor: Actor
  }
) {
  const vault = await getVaultOrThrow(db, vaultId)
  const submission = await getSubmissionInVaultOrThrow(db, vaultId, submissionId)
  if (submission.status !== "pending") {
    throw conflict("Only pending submissions can be approved.")
  }

  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "vault:update",
  })

  const reviewerId = await ensureActorUser(db, input.actor)
  const spaceId =
    input.spaceId ??
    submission.spaceId ??
    (await getDefaultSpaceId(db, vaultId)) ??
    null
  if (spaceId) await getSpaceInVaultOrThrow(db, vaultId, spaceId)

  const resourceId = newId()
  const now = new Date().toISOString()
  const dedupeKey = getDuplicateResourceKey(submission.url)
  await ensureResourceUrlNotDuplicate(db, vaultId, dedupeKey)

  await db.transaction(async (tx) => {
    await tx.insert(resources).values({
      id: resourceId,
      vaultId,
      spaceId,
      type: submission.type,
      title: submission.title,
      description: submission.description,
      url: submission.url,
      dedupeKey,
      metadataStatus: "pending",
      createdBy: submission.submitterId,
    })
    await tx.insert(resourceMetadata).values({
      resourceId,
      provider: submission.type,
      status: "pending",
      dataJson: submission.metadataJson,
    })
    await tx
      .update(resourceSubmissions)
      .set({
        status: "approved",
        reviewedBy: reviewerId,
        reviewNote: input.note ?? "",
        reviewedAt: now,
        approvedResourceId: resourceId,
        updatedAt: now,
      })
      .where(eq(resourceSubmissions.id, submissionId))
  })

  if (submission.submitterId && submission.submitterId !== vault.ownerId) {
    await ensureEditorCollaborator(db, vaultId, submission.submitterId)
  }

  return {
    id: submissionId,
    status: "approved" as const,
    resourceId,
    metadataTask: createMetadataQueueMessage(
      vaultId,
      resourceId,
      submission.type,
      submission.url
    ),
  }
}

export async function rejectResourceSubmission(
  db: Db,
  vaultId: string,
  submissionId: string,
  input: {
    note?: string
    actor: Actor
  }
) {
  const submission = await getSubmissionInVaultOrThrow(db, vaultId, submissionId)
  if (submission.status !== "pending") {
    throw conflict("Only pending submissions can be rejected.")
  }

  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "vault:update",
  })

  const reviewerId = await ensureActorUser(db, input.actor)
  const now = new Date().toISOString()

  await db
    .update(resourceSubmissions)
    .set({
      status: "rejected",
      reviewedBy: reviewerId,
      reviewNote: input.note ?? "",
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(resourceSubmissions.id, submissionId))

  return { id: submissionId, status: "rejected" as const }
}

async function getSubmissionInVaultOrThrow(db: Db, vaultId: string, submissionId: string) {
  const [submission] = await db
    .select({
      id: resourceSubmissions.id,
      vaultId: resourceSubmissions.vaultId,
      spaceId: resourceSubmissions.spaceId,
      status: resourceSubmissions.status,
      submitterId: resourceSubmissions.submitterId,
      type: resourceSubmissions.type,
      title: resourceSubmissions.title,
      description: resourceSubmissions.description,
      url: resourceSubmissions.url,
      metadataJson: resourceSubmissions.metadataJson,
    })
    .from(resourceSubmissions)
    .where(
      and(
        eq(resourceSubmissions.id, submissionId),
        eq(resourceSubmissions.vaultId, vaultId),
        isNull(resourceSubmissions.deletedAt)
      )
    )
    .limit(1)

  if (!submission) throw notFound("Submission not found.")
  return submission
}
