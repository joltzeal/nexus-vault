import { and, desc, eq, isNull } from "drizzle-orm"

import { collaborators, comments, resources } from "@nexus-vault/db/schema"
import { notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import type { NotificationQueueMessage } from "@/server/services/notification-service"
import {
  requireVaultPermission,
  requireVaultRead,
} from "@/server/services/permission-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export async function listComments(
  db: Db,
  vaultId: string,
  options: {
    resourceId: string
    actor?: Actor
    userEmail?: string
  }
) {
  await getResourceInVaultOrThrow(db, vaultId, options.resourceId)
  await requireVaultRead(db, {
    vaultId,
    actor: options.actor,
    userEmail: options.userEmail,
  })

  return db
    .select({
      id: comments.id,
      resourceId: comments.resourceId,
      parentId: comments.parentId,
      authorName: comments.authorName,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      deletedAt: comments.deletedAt,
    })
    .from(comments)
    .where(
      and(
        eq(comments.vaultId, vaultId),
        eq(comments.resourceId, options.resourceId)
      )
    )
    .orderBy(desc(comments.createdAt))
}

export async function createComment(
  db: Db,
  vaultId: string,
  input: {
    resourceId: string
    parentId?: string
    authorName: string
    body: string
    actor?: Actor
    userEmail?: string
  }
) {
  const vault = await getVaultOrThrow(db, vaultId)
  await getResourceInVaultOrThrow(db, vaultId, input.resourceId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "comment:create",
  })
  const authorId = input.actor ? await ensureActorUser(db, input.actor) : undefined

  const commentId = newId("comment")
  await db.insert(comments).values({
    id: commentId,
    vaultId,
    resourceId: input.resourceId,
    parentId: input.parentId,
    authorId,
    authorName: input.actor?.name ?? input.authorName,
    body: input.body,
  })

  const recipients = await db
    .select({ userId: collaborators.userId })
    .from(collaborators)
    .where(eq(collaborators.vaultId, vaultId))

  const recipientIds = new Set(
    [vault.ownerId, ...recipients.map((recipient) => recipient.userId)].filter(
      (userId): userId is string => Boolean(userId && userId !== authorId)
    )
  )

  const notificationTasks: NotificationQueueMessage[] = Array.from(recipientIds)
    .map((userId) => ({
      kind: "notification.create",
      userId,
      vaultId,
      type: "comment.created",
      title: "资源有新评论",
      body: input.body.slice(0, 120),
      requestedAt: new Date().toISOString(),
    }))

  return { id: commentId, notificationTasks }
}

async function getResourceInVaultOrThrow(db: Db, vaultId: string, resourceId: string) {
  const [resource] = await db
    .select({
      id: resources.id,
    })
    .from(resources)
    .where(
      and(
        eq(resources.id, resourceId),
        eq(resources.vaultId, vaultId),
        isNull(resources.deletedAt)
      )
    )
    .limit(1)

  if (!resource) {
    throw notFound("Resource not found in this vault.")
  }

  return resource
}

export async function deleteComment(
  db: Db,
  vaultId: string,
  resourceId: string,
  commentId: string,
  input: {
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await getResourceInVaultOrThrow(db, vaultId, resourceId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "comment:delete",
  })

  const now = new Date().toISOString()
  await db
    .update(comments)
    .set({
      body: "",
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(comments.id, commentId),
        eq(comments.vaultId, vaultId),
        eq(comments.resourceId, resourceId)
      )
    )

  return { id: commentId, deleted: true }
}
