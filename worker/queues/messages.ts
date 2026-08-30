import type { MetadataQueueMessage } from "../metadata/index"
import {
  isCloudDriveCheckQueueMessage,
  type CloudDriveCheckQueueMessage,
} from "../services/cloud-drive-check-service"
import type { NotificationQueueMessage } from "../services/notification-service"
import {
  isResourceAiSummaryQueueMessage,
  type ResourceAiSummaryQueueMessage,
} from "../services/resource-ai-summary-service"

export {
  isCloudDriveCheckQueueMessage,
  isResourceAiSummaryQueueMessage,
}

export type QueueMessage =
  | MetadataQueueMessage
  | NotificationQueueMessage
  | ResourceAiSummaryQueueMessage
  | CloudDriveCheckQueueMessage

export function isQueueMessage(message: unknown): message is QueueMessage {
  return (
    isMetadataQueueMessage(message) ||
    isNotificationQueueMessage(message) ||
    isResourceAiSummaryQueueMessage(message) ||
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
