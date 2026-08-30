import type { ApiContext } from "../types/legacy-api"
import type { QueueMessage } from "./messages"

export function enqueueQueueMessage(
  c: ApiContext,
  message: QueueMessage,
  options: {
    delaySeconds?: number
    label: string
  }
) {
  if (!hasQueueBinding(c.env)) return false

  c.executionCtx.waitUntil(sendQueueMessage(c, message, options))
  return true
}

export async function sendQueueMessage(
  c: ApiContext,
  message: QueueMessage,
  options: {
    delaySeconds?: number
    label: string
  }
) {
  return sendQueueMessageToEnv(c.env, message, options)
}

export async function sendQueueMessageToEnv(
  env: Partial<CloudflareEnv> | undefined,
  message: QueueMessage,
  options: {
    delaySeconds?: number
    label: string
  }
) {
  const queue = getQueueBinding(env)
  if (!queue) return false

  try {
    await queue.send(
      message,
      options.delaySeconds ? { delaySeconds: options.delaySeconds } : undefined,
    )
    return true
  } catch (error) {
    console.error(`${options.label} queue enqueue failed`, {
      kind: message.kind,
      error,
    })
    return false
  }
}

export function hasQueueBinding(
  env: Partial<CloudflareEnv> | undefined
) {
  const queue = getQueueBinding(env)
  return Boolean(queue)
}

function getQueueBinding(env: Partial<CloudflareEnv> | undefined) {
  const bindings = env as (Partial<CloudflareEnv> & { QUEUE?: Queue }) | undefined

  return normalizeQueueBinding(bindings?.QUEUE)
}

function normalizeQueueBinding(queue: Queue | undefined) {
  return typeof queue?.send === "function"
    ? queue
    : undefined
}
