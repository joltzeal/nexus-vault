import type { Db } from "@/server/api/types"
import type { QueueMessage } from "@/server/queues/messages"
import {
  isCloudDriveCheckQueueMessage,
  isMetadataQueueMessage,
  isNotificationQueueMessage,
  isResourceAiSummaryQueueMessage,
} from "@/server/queues/messages"
import { processCloudDriveCheckMessage } from "@/server/services/cloud-drive-check-service"
import { processMetadataMessage } from "@/server/services/metadata-service"
import { processNotificationMessage } from "@/server/services/notification-service"
import { processResourceAiSummaryMessage } from "@/server/services/resource-ai-summary-service"

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
