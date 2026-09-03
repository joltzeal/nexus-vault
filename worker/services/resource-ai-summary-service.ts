import { and, eq, or } from "drizzle-orm"

import { createDbSession } from "../db/index"
import { resourceMetadata, resources } from "../db/schema"
import {
  normalizeResourceMetadata,
  type NormalizedResourceMetadata,
} from "../domain/resources/metadata"
import type { ResourceType } from "../domain/resources/types"
import type { Actor, Db } from "../types/legacy-api"
import { getResourceOrThrow } from "./resource-service"
import { requireVaultRead } from "./permission-service"

const DEFAULT_AI_GATEWAY_ID = "default"
const DEFAULT_AI_SUMMARY_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8"
const AI_SUMMARY_CACHE_TTL_SECONDS = 3360
const AI_SUMMARY_MAX_LENGTH = 2_000
const AI_SUMMARY_PROCESSING_STALE_MS = 5 * 60 * 1000

export type ResourceAiSummaryQueueMessage = {
  kind: "resource.ai-summary"
  requestedAt: string
  resourceId: string
  vaultId: string
}

type ResourceAiSummaryState = {
  completedAt?: string
  error?: string
  gatewayId: string
  model: string
  requestedAt?: string
  startedAt?: string
  status: "pending" | "processing" | "completed" | "failed"
  text?: string
}

export type ResourceAiSummaryStreamUpdate = {
  aiSummary: {
    error?: string
    status: ResourceAiSummaryState["status"]
    text?: string
  } | null
  description: string
  id: string
  metadataStatus: "pending" | "processing" | "completed" | "failed"
}

const AI_SUMMARY_STREAM_POLL_MS = 250
const AI_SUMMARY_STREAM_HEARTBEAT_MS = 15_000
const AI_SUMMARY_STREAM_MAX_MS = 5 * 60 * 1000

type WorkersAiBinding = {
  run(
    model: string,
    input: Record<string, unknown>,
    options: {
      gateway: {
        cacheTtl: number
        id: string
        retries: {
          backoff: "exponential"
          maxAttempts: 3
          retryDelayMs: number
        }
        skipCache: boolean
      }
    },
  ): Promise<ReadableStream<string | Uint8Array>>
}

export function createResourceAiSummaryQueueMessage(
  resourceId: string,
  vaultId: string,
): ResourceAiSummaryQueueMessage {
  return {
    kind: "resource.ai-summary",
    requestedAt: new Date().toISOString(),
    resourceId,
    vaultId,
  }
}

export function isResourceAiSummaryQueueMessage(
  value: unknown,
): value is ResourceAiSummaryQueueMessage {
  return isRecord(value) &&
    value.kind === "resource.ai-summary" &&
    typeof value.resourceId === "string" &&
    typeof value.vaultId === "string"
}

export function shouldGenerateResourceAiSummary(input: {
  currentDescription: string
  data: NormalizedResourceMetadata
  env?: Partial<CloudflareEnv>
  provider: string
  status: "pending" | "processing" | "completed" | "failed"
  type: ResourceType
}) {
  if (!input.env?.AI || input.status !== "completed" || input.type !== "http") {
    return false
  }
  if (input.provider !== "http-page" && input.provider !== "github") return false
  if (input.provider === "http-page") {
    const http = isRecord(input.data.extra?.http) ? input.data.extra.http : undefined
    const content = typeof http?.content === "string" ? http.content.trim() : ""
    if (!content && !input.data.description?.trim()) return false
  }

  const currentDescription = input.currentDescription.trim()
  const providerDescription = input.data.description?.trim() ?? ""
  return !currentDescription || currentDescription === providerDescription
}

export function markResourceAiSummaryPending(
  data: NormalizedResourceMetadata,
  env?: Partial<CloudflareEnv>,
) {
  return withAiSummaryState(data, {
    gatewayId: getRuntimeString(env, "AI_GATEWAY_ID") ?? DEFAULT_AI_GATEWAY_ID,
    model: getRuntimeString(env, "AI_SUMMARY_MODEL") ?? DEFAULT_AI_SUMMARY_MODEL,
    requestedAt: new Date().toISOString(),
    status: "pending",
  })
}

export async function createResourceAiSummaryStream(
  db: Db,
  env: CloudflareEnv,
  resourceId: string,
  actor: Actor | undefined,
  signal: AbortSignal,
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireVaultRead(db, { actor, vaultId: resource.vaultId })

  const encoder = new TextEncoder()
  let cancelled = signal.aborted
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let controllerClosed = false
      let session: Awaited<ReturnType<typeof createDbSession>> | undefined

      const closeController = () => {
        if (controllerClosed) return
        controllerClosed = true
        try {
          controller.close()
        } catch {
          // The client may have cancelled the stream before the abort event ran.
        }
      }

      if (signal.aborted) {
        cancelled = true
        closeController()
        return
      }

      const abort = () => {
        cancelled = true
        closeController()
      }
      signal.addEventListener("abort", abort, { once: true })

      void (async () => {
        let lastUpdate = ""
        let lastHeartbeatAt = Date.now()
        const deadline = Date.now() + AI_SUMMARY_STREAM_MAX_MS

        try {
          // The request handler closes its short-lived database connection as
          // soon as this Response is returned. Keep one session for the SSE
          // lifetime instead of opening a new PostgreSQL connection per poll.
          session = await createDbSession(env)

          while (!cancelled && !signal.aborted && Date.now() < deadline) {
            const update = await readResourceAiSummaryStreamUpdate(
              session.db,
              resourceId,
            )
            if (!update) break
            if (cancelled || signal.aborted || controllerClosed) break

            const serialized = JSON.stringify(update)
            if (serialized !== lastUpdate) {
              controller.enqueue(encoder.encode(`data: ${serialized}\n\n`))
              lastUpdate = serialized
            } else if (Date.now() - lastHeartbeatAt >= AI_SUMMARY_STREAM_HEARTBEAT_MS) {
              controller.enqueue(encoder.encode(": heartbeat\n\n"))
              lastHeartbeatAt = Date.now()
            }

            if (
              update.aiSummary?.status === "completed" ||
              update.aiSummary?.status === "failed"
            ) {
              break
            }

            await wait(AI_SUMMARY_STREAM_POLL_MS)
          }
        } catch (error) {
          if (!cancelled && !signal.aborted && !controllerClosed) {
            const message = error instanceof Error
              ? error.message
              : "AI summary stream failed."
            try {
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
              )
            } catch {
              cancelled = true
            }
          }
        } finally {
          signal.removeEventListener("abort", abort)
          try {
            await session?.close()
          } catch (error) {
            console.error("AI summary stream database session close failed", error)
          }
          if (!cancelled && !signal.aborted) closeController()
        }
      })()
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  })
}

export async function processResourceAiSummaryMessage(
  db: Db,
  message: ResourceAiSummaryQueueMessage,
  options: {
    env?: CloudflareEnv
    retryTransient?: boolean
  } = {},
) {
  const env = options.env
  if (!env?.AI) return

  const resource = await getResourceOrThrow(db, message.resourceId)
  if (resource.vaultId !== message.vaultId || resource.type !== "http") return

  const [row] = await db
    .select({ dataJson: resourceMetadata.dataJson, provider: resourceMetadata.provider })
    .from(resourceMetadata)
    .where(eq(resourceMetadata.resourceId, message.resourceId))
    .limit(1)
  if (!row) return
  const data = normalizeResourceMetadata(row.dataJson)
  if (!data || (row.provider !== "http-page" && row.provider !== "github")) return

  const currentState = getAiSummaryState(data)
  if (currentState?.status === "completed") return
  if (
    currentState?.status === "processing" &&
    currentState.startedAt &&
    Date.now() - new Date(currentState.startedAt).getTime() < AI_SUMMARY_PROCESSING_STALE_MS
  ) {
    return
  }

  const gatewayId = currentState?.gatewayId ||
    getRuntimeString(env, "AI_GATEWAY_ID") ||
    DEFAULT_AI_GATEWAY_ID
  const model = currentState?.model ||
    getRuntimeString(env, "AI_SUMMARY_MODEL") ||
    DEFAULT_AI_SUMMARY_MODEL
  const requestedAt = currentState?.requestedAt || message.requestedAt
  const startedAt = new Date().toISOString()
  let workingData = await persistAiSummaryState(db, message.resourceId, data, {
    gatewayId,
    model,
    requestedAt,
    startedAt,
    status: "processing",
    text: "",
  })

  try {
    const prompt = createSummaryPrompt(resource, workingData, row.provider)
    const stream = await (env.AI as unknown as WorkersAiBinding).run(
      model,
      {
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content:
              "你是资源归档助手。根据给定网页或 GitHub metadata 生成准确、紧凑的简体中文 Markdown 摘要。必须使用简体中文，项目名、产品名、API 和代码标识符可以保留原文。先写一个简短概述段落，仅在有帮助时追加二到四个一级要点；可以用少量粗体强调关键词。不要使用标题、表格、代码块、嵌套列表、前缀、免责声明或思考过程。只输出最终摘要，不要编造输入中不存在的信息。",
          },
          { role: "user", content: prompt },
        ],
        stream: true,
        temperature: 0.2,
      },
      {
        gateway: {
          cacheTtl: AI_SUMMARY_CACHE_TTL_SECONDS,
          id: gatewayId,
          retries: {
            backoff: "exponential",
            maxAttempts: 3,
            retryDelayMs: 500,
          },
          skipCache: false,
        },
      },
    )

    let summary = ""
    let lastPersistedAt = Date.now()
    let lastPersistedLength = 0
    for await (const delta of readWorkersAiTextStream(stream)) {
      summary = `${summary}${delta}`.slice(0, AI_SUMMARY_MAX_LENGTH)
      const shouldPersist =
        summary.length - lastPersistedLength >= 24 ||
        Date.now() - lastPersistedAt >= 250
      if (!shouldPersist) continue

      workingData = await persistAiSummaryState(db, message.resourceId, workingData, {
        gatewayId,
        model,
        requestedAt,
        startedAt,
        status: "processing",
        text: summary,
      })
      lastPersistedAt = Date.now()
      lastPersistedLength = summary.length
    }

    summary = normalizeSummary(summary)
    if (!summary) throw new Error("Workers AI returned an empty summary.")
    if (!containsChineseText(summary)) {
      throw new Error("Workers AI returned a summary that is not in Chinese.")
    }

    const completedAt = new Date().toISOString()
    workingData = removeHttpSummarySource(
      withAiSummaryState(workingData, {
        completedAt,
        gatewayId,
        model,
        requestedAt,
        startedAt,
        status: "completed",
        text: summary,
      }),
    )
    await db.transaction(async (tx) => {
      await tx
        .update(resourceMetadata)
        .set({ dataJson: workingData as unknown as Record<string, unknown> })
        .where(eq(resourceMetadata.resourceId, message.resourceId))
      await tx
        .update(resources)
        .set({ description: summary, updatedAt: completedAt })
        .where(
          and(
            eq(resources.id, message.resourceId),
            or(
              eq(resources.description, resource.description),
              eq(resources.description, ""),
              ...(data.description
                ? [eq(resources.description, data.description)]
                : []),
            ),
          ),
        )
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "AI summary failed."
    console.error("AI summary generation failed", {
      error: errorMessage,
      gatewayId,
      model,
      resourceId: message.resourceId,
    })
    const nextStatus = options.retryTransient ? "pending" : "failed"
    const errorData = options.retryTransient
      ? workingData
      : removeHttpSummarySource(workingData)
    await persistAiSummaryState(db, message.resourceId, errorData, {
      error: errorMessage,
      gatewayId,
      model,
      requestedAt,
      startedAt,
      status: nextStatus,
    })
    if (options.retryTransient) throw error
  }
}

function createSummaryPrompt(
  resource: Awaited<ReturnType<typeof getResourceOrThrow>>,
  data: NormalizedResourceMetadata,
  provider: string,
) {
  const lines = [
    `资源 URL：${resource.url}`,
    `资源标题：${data.title || resource.title}`,
  ]
  if (data.description) lines.push(`已有描述：${data.description}`)

  if (provider === "github" && data.preview?.data) {
    lines.push(`GitHub metadata：${JSON.stringify(data.preview.data).slice(0, 16_000)}`)
  } else {
    const http = isRecord(data.extra?.http) ? data.extra.http : undefined
    const content = typeof http?.content === "string" ? http.content.trim() : ""
    if (content) lines.push(`网页正文：\n${content.slice(0, 16_000)}`)
  }
  return lines.join("\n\n")
}

async function* readWorkersAiTextStream(
  stream: ReadableStream<string | Uint8Array>,
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let receivedSse = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += typeof value === "string"
        ? value
        : decoder.decode(value, { stream: true })

      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trimEnd()
        buffer = buffer.slice(newlineIndex + 1)
        const delta = parseWorkersAiDataLine(line)
        if (delta !== undefined) {
          receivedSse = true
          if (delta) yield delta
        }
        newlineIndex = buffer.indexOf("\n")
      }
    }

    buffer += decoder.decode()
    const finalDelta = parseWorkersAiDataLine(buffer.trim())
    if (finalDelta !== undefined) {
      receivedSse = true
      if (finalDelta) yield finalDelta
    } else if (!receivedSse && buffer.trim()) {
      yield buffer
    }
  } finally {
    reader.releaseLock()
  }
}

function parseWorkersAiDataLine(line: string) {
  if (!line.startsWith("data:")) return undefined
  const value = line.slice(5).trim()
  if (!value || value === "[DONE]") return ""

  try {
    const payload: unknown = JSON.parse(value)
    if (!isRecord(payload)) return ""
    if (typeof payload.response === "string") return payload.response
    if (typeof payload.delta === "string") return payload.delta
    return ""
  } catch {
    return value
  }
}

async function persistAiSummaryState(
  db: Db,
  resourceId: string,
  data: NormalizedResourceMetadata,
  state: ResourceAiSummaryState,
) {
  const nextData = withAiSummaryState(data, state)
  await db
    .update(resourceMetadata)
    .set({ dataJson: nextData as unknown as Record<string, unknown> })
    .where(eq(resourceMetadata.resourceId, resourceId))
  return nextData
}

async function readResourceAiSummaryStreamUpdate(
  db: Db,
  resourceId: string,
): Promise<ResourceAiSummaryStreamUpdate | null> {
  const [row] = await db
    .select({
      description: resources.description,
      id: resources.id,
      metadataDataJson: resourceMetadata.dataJson,
      metadataStatus: resources.metadataStatus,
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!row) return null
  const data = normalizeResourceMetadata(row.metadataDataJson)
  const aiSummary = getAiSummaryState(data ?? createEmptyMetadata())

  return {
    aiSummary: aiSummary
      ? {
          ...(aiSummary.error ? { error: aiSummary.error } : {}),
          status: aiSummary.status,
          ...(aiSummary.text ? { text: aiSummary.text } : {}),
        }
      : null,
    description: row.description,
    id: row.id,
    metadataStatus: row.metadataStatus,
  }
}

function createEmptyMetadata(): NormalizedResourceMetadata {
  return {
    fetchedAt: "",
    schemaVersion: 1,
    tree: [],
    type: "http",
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function withAiSummaryState(
  data: NormalizedResourceMetadata,
  state: ResourceAiSummaryState,
): NormalizedResourceMetadata {
  return {
    ...data,
    extra: {
      ...data.extra,
      aiSummary: state,
    },
  }
}

function removeHttpSummarySource(
  data: NormalizedResourceMetadata,
): NormalizedResourceMetadata {
  const http = data.extra?.http
  if (!isRecord(http) || !("content" in http)) return data
  const httpWithoutContent = { ...http }
  delete httpWithoutContent.content
  return {
    ...data,
    extra: {
      ...data.extra,
      http: httpWithoutContent,
    },
  }
}

function getAiSummaryState(data: NormalizedResourceMetadata) {
  const value = data.extra?.aiSummary
  if (!isRecord(value)) return undefined
  if (
    value.status !== "pending" &&
    value.status !== "processing" &&
    value.status !== "completed" &&
    value.status !== "failed"
  ) {
    return undefined
  }
  return value as ResourceAiSummaryState
}

function normalizeSummary(value: string) {
  return value
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^#+\s*(?:摘要|Summary)\s*\n?/i, "")
    .trim()
    .slice(0, AI_SUMMARY_MAX_LENGTH)
}

function containsChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function getRuntimeString(env: Partial<CloudflareEnv> | undefined, key: string) {
  const value = (env as unknown as Record<string, unknown> | undefined)?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
