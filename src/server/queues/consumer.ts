import type { Db } from "@/server/api/types"
import type { QueueMessage } from "@/server/queues/messages"
import {
  isMetadataQueueMessage,
  isNotificationQueueMessage,
} from "@/server/queues/messages"
import { processMetadataMessage } from "@/server/services/metadata-service"
import { processNotificationMessage } from "@/server/services/notification-service"

export async function processQueueMessage(
  db: Db,
  message: QueueMessage,
  options: {
    env?: CloudflareEnv
  } = {}
) {
  if (isMetadataQueueMessage(message)) {
    await processMetadataMessage(db, message, options)
    return
  }

  if (isNotificationQueueMessage(message)) {
    await processNotificationMessage(db, message)
  }
}
