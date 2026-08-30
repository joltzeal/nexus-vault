import type { Db } from "../types/legacy-api"
import type { QueueMessage } from "./messages"
import {
  isCloudDriveCheckQueueMessage,
  isMetadataQueueMessage,
  isNotificationQueueMessage,
  isResourceAiSummaryQueueMessage,
} from "./messages"
import { processCloudDriveCheckMessage } from "../services/cloud-drive-check-service"
import { processMetadataMessage } from "../services/metadata-service"
import { processNotificationMessage } from "../services/notification-service"
import { processResourceAiSummaryMessage } from "../services/resource-ai-summary-service"

export async function processQueueMessage(
  db: Db,
  message: QueueMessage,
  options: {
    env: CloudflareEnv
    retryTransient?: boolean
  }
) {
  if (isMetadataQueueMessage(message)) {
    await processMetadataMessage(db, message, options)
    return
  }

  if (isCloudDriveCheckQueueMessage(message)) {
    await processCloudDriveCheckMessage(db, message, options)
    return
  }

  if (isResourceAiSummaryQueueMessage(message)) {
    await processResourceAiSummaryMessage(db, message, options)
    return
  }

  if (isNotificationQueueMessage(message)) {
    await processNotificationMessage(db, message)
  }
}
