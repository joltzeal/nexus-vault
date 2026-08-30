import type { Actor, Db } from "../types/legacy-api"
import {
  getNotificationSummary,
  listNotifications,
  markNotificationsRead,
} from "./notification-service"
import { listResourceSubmissions } from "./submission-service"

export async function getVaultAlerts(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
    includeSubmissions?: boolean
  }
) {
  const includeSubmissions = input.includeSubmissions ?? true
  const [notificationData, notificationSummary, submissionData] = await Promise.all([
    listNotifications(db, {
      actor: input.actor,
    }),
    getNotificationSummary(db, {
      actor: input.actor,
    }),
    includeSubmissions
      ? listResourceSubmissions(db, vaultId, {
          actor: input.actor,
          status: "pending",
        })
      : Promise.resolve([]),
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
