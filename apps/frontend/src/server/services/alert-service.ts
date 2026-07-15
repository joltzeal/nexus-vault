import type { Actor, Db } from "@/server/api/types"
import {
  getNotificationSummary,
  listNotifications,
  markNotificationsRead,
} from "@/server/services/notification-service"
import { listResourceSubmissions } from "@/server/services/submission-service"

export async function getVaultAlerts(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
) {
  const [notificationData, notificationSummary, submissionData] = await Promise.all([
    listNotifications(db, {
      actor: input.actor,
      vaultId,
    }),
    getNotificationSummary(db, {
      actor: input.actor,
      vaultId,
    }),
    listResourceSubmissions(db, vaultId, {
      actor: input.actor,
      status: "pending",
    }),
  ])

  return {
    notifications: notificationData,
    pendingSubmissions: submissionData,
    unreadNotificationCount: notificationSummary.unreadCount,
  }
}

export async function markVaultAlertsRead(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
    notificationIds: string[]
  }
) {
  return markNotificationsRead(db, {
    actor: input.actor,
    notificationIds: input.notificationIds,
    vaultId,
  })
}
