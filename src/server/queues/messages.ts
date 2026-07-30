import type { MetadataQueueMessage } from "@/server/metadata"
import {
  isCloudDriveCheckQueueMessage,
  type CloudDriveCheckQueueMessage,
} from "@/server/services/cloud-drive-check-service"
import type { NotificationQueueMessage } from "@/server/services/notification-service"

export { isCloudDriveCheckQueueMessage }

export type QueueMessage =
  | MetadataQueueMessage
  | NotificationQueueMessage
  | CloudDriveCheckQueueMessage

export function isQueueMessage(message: unknown): message is QueueMessage {
  return (
    isMetadataQueueMessage(message) ||
    isNotificationQueueMessage(message) ||
    isCloudDriveCheckQueueMessage(message)
  )
}

export function isMetadataQueueMessage(message: unknown): message is MetadataQueueMessage {
  return isRecord(message) && message.kind === "metadata.resolve"
}

export function isNotificationQueueMessage(
  message: unknown
): message is NotificationQueueMessage {
  return isRecord(message) && message.kind === "notification.create"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
