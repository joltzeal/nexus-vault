import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm"
import type { Context } from "hono"

import { notifications, users } from "@nexus-vault/db/schema"
import type { Actor, ApiEnv, Db } from "@/server/api/types"
import { newId } from "@/server/utils/id"

const visibleNotificationTypes = ["resource_submission.created"] as const

export type NotificationQueueMessage = {
  kind: "notification.create"
  userId?: string
  userEmail?: string
  vaultId?: string
  type: string
  title: string
  body?: string
  requestedAt: string
}

export function enqueueNotificationTask(
  c: Context<ApiEnv>,
  message: NotificationQueueMessage
) {
  c.executionCtx.waitUntil(sendNotificationQueueMessage(c, message))
}

export async function listNotifications(
  db: Db,
  input: {
    actor?: Actor
    userEmail?: string
    vaultId?: string
  }
) {
  const userId = input.actor
    ? await findUserIdForActor(db, input.actor)
    : input.userEmail
      ? await findUserIdForEmail(db, input.userEmail)
      : undefined

  return db
    .select({
      id: notifications.id,
      vaultId: notifications.vaultId,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        userId ? eq(notifications.userId, userId) : undefined,
        input.vaultId ? eq(notifications.vaultId, input.vaultId) : undefined,
        inArray(notifications.type, visibleNotificationTypes)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50)
}

export async function getNotificationSummary(
  db: Db,
  input: {
    actor?: Actor
    userEmail?: string
    vaultId?: string
  }
) {
  const userId = input.actor
    ? await findUserIdForActor(db, input.actor)
    : input.userEmail
      ? await findUserIdForEmail(db, input.userEmail)
      : undefined

  if (!userId) return { unreadCount: 0 }

  const [row] = await db
    .select({ unreadCount: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        input.vaultId ? eq(notifications.vaultId, input.vaultId) : undefined,
        isNull(notifications.readAt),
        inArray(notifications.type, visibleNotificationTypes)
      )
    )

  return { unreadCount: row?.unreadCount ?? 0 }
}

export async function markNotificationsRead(
  db: Db,
  input: {
    actor: Actor
    notificationIds: string[]
    vaultId?: string
  }
) {
  const userId = await findUserIdForActor(db, input.actor)
  if (!userId || input.notificationIds.length === 0) {
    return { read: 0 }
  }

  const readAt = new Date().toISOString()
  await db
    .update(notifications)
    .set({ readAt })
    .where(
      and(
        eq(notifications.userId, userId),
        inArray(notifications.id, input.notificationIds),
        input.vaultId ? eq(notifications.vaultId, input.vaultId) : undefined,
        inArray(notifications.type, visibleNotificationTypes)
      )
    )

  return { read: input.notificationIds.length, readAt }
}

export async function markNotificationRead(
  db: Db,
  notificationId: string,
  input: {
    actor: Actor
  }
) {
  const userId = await findUserIdForActor(db, input.actor)
  if (!userId) return { id: notificationId, read: false }

  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))

  return { id: notificationId, read: true }
}

export async function processNotificationMessage(
  db: Db,
  message: NotificationQueueMessage
) {
  if (message.kind !== "notification.create") return

  const userId =
    message.userId ??
    (message.userEmail ? await findUserIdForEmail(db, message.userEmail) : undefined)

  if (!userId) return

  await db.insert(notifications).values({
    id: newId(),
    userId,
    vaultId: message.vaultId,
    type: message.type,
    title: message.title,
    body: message.body ?? "",
  })
}

async function sendNotificationQueueMessage(
  c: Context<ApiEnv>,
  message: NotificationQueueMessage
) {
  try {
    await c.env.NOTIFICATION_QUEUE.send(message)
  } catch (error) {
    console.error("Notification queue enqueue failed", {
      type: message.type,
      vaultId: message.vaultId,
      error,
    })
  }
}

async function findUserIdForActor(db: Db, actor: Actor) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.id, actor.id), eq(users.email, actor.email)))
    .limit(1)

  return user?.id
}

async function findUserIdForEmail(db: Db, email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  return user?.id
}
