type ApiEnvelope<T> = {
  data?: T
  error?: { message?: string } | null
  success?: boolean
}

type LocalMediaUploadPlan = {
  resourceId: string
  uploads: Array<{
    clientId: string
    key: string
    uploadId: string
  }>
}

type UploadedLocalMediaFile = {
  clientId: string
  fileName: string
  mimeType: string
  objectKey: string
  size: number
}

export type LocalMediaResourceUpdateInput = {
  description?: string
  files: File[]
  order: string[]
  referer?: string
  spaceId?: string
  title?: string
}

export type LocalMediaUploadProgress = {
  completedBytes: number
  fileIndex: number
  fileProgress: number
  phase: "finalizing" | "preparing" | "uploading"
  speedBytesPerSecond: number
  totalBytes: number
}

const MULTIPART_CHUNK_BYTES = 16 * 1024 * 1024
const MULTIPART_UPLOAD_CONCURRENCY = 6
const MULTIPART_UPLOAD_MAX_ATTEMPTS = 3
const MULTIPART_PART_TIMEOUT_MS = 180_000
const UPLOAD_PROGRESS_THROTTLE_MS = 250

export async function uploadLocalMediaResource(
  vaultId: string,
  input: {
    description?: string
    files: File[]
    referer?: string
    spaceId?: string
    title?: string
  },
  onProgress?: (progress: LocalMediaUploadProgress) => void,
) {
  if (input.files.length === 0) throw new Error("请至少选择一个媒体文件。")

  const session = await uploadLocalMediaFiles(
    input.files,
    `/api/v1/vaults/${encodeURIComponent(vaultId)}/resources/local-media/multipart`,
    onProgress,
  )
  const removePagehideCleanup = registerPagehideCleanup(session.plan)

  try {
    return await requestJson<{ id: string; metadataStatus: "completed" }>(
      `/api/v1/vaults/${encodeURIComponent(vaultId)}/resources/local-media`,
      "POST",
      {
        description: input.description?.trim() || undefined,
        files: session.uploadedFiles,
        referer: input.referer?.trim() || undefined,
        resourceId: session.plan.resourceId,
        spaceId: input.spaceId || undefined,
        title: input.title?.trim() || undefined,
      },
    )
  } catch (error) {
    await abortUploads(session.plan)
    throw error
  } finally {
    removePagehideCleanup()
  }
}

export async function updateLocalMediaResource(
  resourceId: string,
  input: LocalMediaResourceUpdateInput,
  onProgress?: (progress: LocalMediaUploadProgress) => void,
) {
  const session = input.files.length
    ? await uploadLocalMediaFiles(
        input.files,
        `/api/v1/resources/${encodeURIComponent(resourceId)}/local-media/multipart`,
        onProgress,
      )
    : undefined
  const removePagehideCleanup = session
    ? registerPagehideCleanup(session.plan)
    : undefined

  try {
    return await requestJson<{ id: string; metadataStatus: "completed" }>(
      `/api/v1/resources/${encodeURIComponent(resourceId)}/local-media`,
      "PATCH",
      {
        description: input.description?.trim() || undefined,
        files: session?.uploadedFiles ?? [],
        order: input.order,
        referer: input.referer?.trim() || undefined,
        spaceId: input.spaceId || undefined,
        title: input.title?.trim() || undefined,
      },
    )
  } catch (error) {
    if (session) await abortUploads(session.plan)
    throw error
  } finally {
    removePagehideCleanup?.()
  }
}

async function uploadLocalMediaFiles(
  inputFiles: File[],
  preparePath: string,
  onProgress?: (progress: LocalMediaUploadProgress) => void,
) {
  const files = inputFiles.map((file) => ({
    clientId: crypto.randomUUID(),
    file,
  }))
  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0)
  let completedBytes = 0
  onProgress?.({
    completedBytes,
    fileIndex: -1,
    fileProgress: 0,
    phase: "preparing",
    speedBytesPerSecond: 0,
    totalBytes,
  })

  const plan = await requestJson<LocalMediaUploadPlan>(
    preparePath,
    "POST",
    {
      files: files.map(({ clientId, file }) => ({
        clientId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      })),
    },
  )
  const removePagehideCleanup = registerPagehideCleanup(plan)

  try {
    const signedUploads = await requestJson<Array<{
      key: string
      parts: Array<{ method: "PUT"; partNumber: number; url: string }>
      uploadId: string
    }>>("/api/v1/local-media/multipart/sign", "POST", {
      uploads: files.map(({ clientId, file }) => {
        const upload = plan.uploads.find((item) => item.clientId === clientId)
        if (!upload) throw new Error(`未找到文件 ${file.name} 的上传任务。`)
        return {
          key: upload.key,
          partNumbers: Array.from(
            { length: Math.ceil(file.size / MULTIPART_CHUNK_BYTES) },
            (_, index) => index + 1,
          ),
          uploadId: upload.uploadId,
        }
      }),
    })

    const tasks = files.flatMap(({ clientId, file }, fileIndex) => {
      const upload = plan.uploads.find((item) => item.clientId === clientId)
      if (!upload) throw new Error(`未找到文件 ${file.name} 的上传任务。`)
      const signed = signedUploads.find((item) => item.key === upload.key && item.uploadId === upload.uploadId)
      if (!signed) throw new Error(`未找到文件 ${file.name} 的分片签名。`)
      return signed.parts.map((signedPart) => ({ file, fileIndex, signedPart }))
    })

    const partsByFileIndex = files.map(() => [] as Array<{ ETag: string; PartNumber: number }>)
    const uploadedBytesByFileIndex = files.map(() => 0)
    const reportedBytesByTask = new Map<string, number>()
    const activeRequests = new Set<XMLHttpRequest>()
    let uploadFailed = false
    let phase: LocalMediaUploadProgress["phase"] = "preparing"
    let progressTimer: number | undefined
    let lastProgressAt = 0
    let lastProgressFileIndex = -1
    let lastSpeedAt = Date.now()
    let lastSpeedBytes = 0

    const publishProgress = (fileIndex: number, force = false) => {
      if (!onProgress) return
      lastProgressFileIndex = fileIndex
      const now = Date.now()
      if (!force && now - lastProgressAt < UPLOAD_PROGRESS_THROTTLE_MS) {
        if (progressTimer === undefined) {
          progressTimer = window.setTimeout(() => {
            progressTimer = undefined
            publishProgress(lastProgressFileIndex, true)
          }, UPLOAD_PROGRESS_THROTTLE_MS - (now - lastProgressAt))
        }
        return
      }
      if (progressTimer !== undefined) {
        window.clearTimeout(progressTimer)
        progressTimer = undefined
      }
      lastProgressAt = now
      const elapsed = now - lastSpeedAt
      const speedBytesPerSecond =
        phase === "uploading" && elapsed > 0
          ? Math.max(0, ((completedBytes - lastSpeedBytes) * 1000) / elapsed)
          : 0
      lastSpeedAt = now
      lastSpeedBytes = completedBytes
      onProgress({
        completedBytes,
        fileIndex,
        fileProgress:
          fileIndex >= 0
            ? (uploadedBytesByFileIndex[fileIndex]! / files[fileIndex]!.file.size) * 100
            : 0,
        phase,
        speedBytesPerSecond,
        totalBytes,
      })
    }

    const abortActiveRequests = () => {
      for (const request of activeRequests) request.abort()
    }

    const resetTaskProgress = (taskId: string, fileIndex: number) => {
      const reported = reportedBytesByTask.get(taskId) ?? 0
      if (reported === 0) return
      reportedBytesByTask.set(taskId, 0)
      uploadedBytesByFileIndex[fileIndex]! -= reported
      completedBytes -= reported
      publishProgress(fileIndex)
    }

    let nextTaskIndex = 0
    try {
      phase = "uploading"
      publishProgress(-1, true)
      await Promise.all(
        Array.from({ length: Math.min(MULTIPART_UPLOAD_CONCURRENCY, tasks.length) }, async () => {
          while (nextTaskIndex < tasks.length) {
            if (uploadFailed) return
            const task = tasks[nextTaskIndex++]!
            const partOffset = (task.signedPart.partNumber - 1) * MULTIPART_CHUNK_BYTES
            const chunk = task.file.slice(
              partOffset,
              Math.min(partOffset + MULTIPART_CHUNK_BYTES, task.file.size),
            )
            const taskId = `${task.fileIndex}:${task.signedPart.partNumber}`
            let etag: string | undefined
            for (let attempt = 1; attempt <= MULTIPART_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
              if (uploadFailed) return
              try {
                etag = await uploadPartWithProgress(
                  task.signedPart.url,
                  task.signedPart.method,
                  chunk,
                  activeRequests,
                  (loaded) => {
                    const previous = reportedBytesByTask.get(taskId) ?? 0
                    const next = Math.min(chunk.size, Math.max(previous, loaded))
                    const delta = next - previous
                    if (delta === 0) return
                    reportedBytesByTask.set(taskId, next)
                    uploadedBytesByFileIndex[task.fileIndex]! += delta
                    completedBytes += delta
                    publishProgress(task.fileIndex)
                  },
                )
                break
              } catch (error) {
                resetTaskProgress(taskId, task.fileIndex)
                if (uploadFailed) return
                if (attempt === MULTIPART_UPLOAD_MAX_ATTEMPTS) {
                  uploadFailed = true
                  abortActiveRequests()
                  throw new Error(
                    `上传 ${task.file.name} 第 ${task.signedPart.partNumber} 个分片失败。`,
                    { cause: error },
                  )
                }
                await waitForRetry(attempt)
              }
            }
            if (!etag) throw new Error(`上传 ${task.file.name} 第 ${task.signedPart.partNumber} 个分片失败。`)
            partsByFileIndex[task.fileIndex]!.push({
              ETag: etag,
              PartNumber: task.signedPart.partNumber,
            })
          }
        }),
      )
    } finally {
      if (progressTimer !== undefined) window.clearTimeout(progressTimer)
      progressTimer = undefined
      publishProgress(lastProgressFileIndex, true)
    }

    phase = "finalizing"
    publishProgress(-1, true)
    const completionTasks = files.map(({ clientId, file }, fileIndex) => {
      const upload = plan.uploads.find((item) => item.clientId === clientId)!
      return {
        clientId,
        fileName: file.name,
        mimeType: file.type,
        objectKey: upload.key,
        size: file.size,
        parts: partsByFileIndex[fileIndex],
        uploadId: upload.uploadId,
      }
    })
    await Promise.all(completionTasks.map(({ objectKey, parts, uploadId }) =>
      requestJson("/api/v1/local-media/multipart", "POST", {
        key: objectKey,
        parts,
        uploadId,
      }),
    ))
    const uploadedFiles: UploadedLocalMediaFile[] = completionTasks.map((file) => ({
      clientId: file.clientId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      objectKey: file.objectKey,
      size: file.size,
    }))
    return {
      plan,
      uploadedFiles,
    }
  } catch (error) {
    await abortUploads(plan)
    throw error
  } finally {
    removePagehideCleanup()
  }
}

function uploadPartWithProgress(
  url: string,
  method: "PUT",
  body: Blob,
  activeRequests: Set<XMLHttpRequest>,
  onProgress: (loaded: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest()
    activeRequests.add(request)
    const cleanup = () => activeRequests.delete(request)
    request.open(method, url)
    request.timeout = MULTIPART_PART_TIMEOUT_MS
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable || event.loaded > 0) onProgress(event.loaded)
    })
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`S3 returned HTTP ${request.status}.`))
        return
      }
      onProgress(body.size)
      const etag = request.getResponseHeader("ETag")
      if (!etag) {
        reject(new Error("S3 did not return an ETag."))
        return
      }
      resolve(etag)
    })
    request.addEventListener("error", () => reject(new Error("Network error.")))
    request.addEventListener("abort", () => reject(new Error("Upload aborted.")))
    request.addEventListener("timeout", () => reject(new Error("Upload timed out.")))
    request.addEventListener("loadend", cleanup)
    request.send(body)
  })
}

function waitForRetry(attempt: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.min(2_000, 250 * 2 ** (attempt - 1)))
  })
}

function registerPagehideCleanup(plan: LocalMediaUploadPlan) {
  const handler = () => {
    void abortUploads(plan, true)
  }
  window.addEventListener("pagehide", handler)
  return () => window.removeEventListener("pagehide", handler)
}

async function abortUploads(plan: LocalMediaUploadPlan, keepalive = false) {
  await Promise.allSettled(
    plan.uploads.map((upload) =>
      requestJson("/api/v1/local-media/multipart", "DELETE", {
        key: upload.key,
        uploadId: upload.uploadId,
      }, keepalive),
    ),
  )
}

async function requestJson<T = unknown>(
  path: string,
  method: "DELETE" | "GET" | "PATCH" | "POST",
  body?: unknown,
  keepalive = false,
) {
  const response = await fetch(path, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
    credentials: "include",
    keepalive,
    method,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "媒体上传失败。")
  }
  if (!payload?.data) throw new Error("媒体上传响应为空。")
  return payload.data
}
