import { createDbSession } from "@/db"
import { isQueueMessage, type QueueMessage } from "@/server/queues/messages"
import { processQueueMessage } from "@/server/queues/consumer"

export async function consumeQueueBatch(
  batch: MessageBatch<unknown>,
  env: CloudflareEnv
) {
  const session = await createDbSession(env)

  try {
    for (const message of batch.messages) {
      if (!isQueueMessage(message.body)) {
        console.warn("Invalid queue message skipped", {
          id: message.id,
          queue: batch.queue,
          body: message.body,
        })
        message.ack()
        continue
      }

      await processQueueMessageSafely(session.db, message, message.body, env, batch.queue)
    }
  } finally {
    await session.close()
  }
}

async function processQueueMessageSafely(
  db: Awaited<ReturnType<typeof createDbSession>>["db"],
  message: Message<unknown>,
  body: QueueMessage,
  env: CloudflareEnv,
  queue: string
) {
  try {
    await processQueueMessage(db, body, { env })
    message.ack()
  } catch (error) {
    console.error("Queue message failed", {
      id: message.id,
      queue,
      kind: body.kind,
      attempts: message.attempts,
      error,
    })
    message.retry({ delaySeconds: getRetryDelaySeconds(message.attempts) })
  }
}

function getRetryDelaySeconds(attempts: number) {
  return Math.min(300, Math.max(10, attempts * 30))
}
