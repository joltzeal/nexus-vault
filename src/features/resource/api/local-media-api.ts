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
  totalBytes: number
}

const MULTIPART_CHUNK_BYTES = 8 * 1024 * 1024

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
  onProgress?.({ completedBytes, fileIndex: -1, fileProgress: 0, totalBytes })

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

  const uploadedFiles: UploadedLocalMediaFile[] = []
  try {
    for (const [fileIndex, { clientId, file }] of files.entries()) {
      const upload = plan.uploads.find((item) => item.clientId === clientId)
      if (!upload) throw new Error(`未找到文件 ${file.name} 的上传任务。`)

      const parts: Array<{ ETag: string; PartNumber: number }> = []
      let partNumber = 1
      for (let offset = 0; offset < file.size; offset += MULTIPART_CHUNK_BYTES) {
        const chunk = file.slice(offset, Math.min(offset + MULTIPART_CHUNK_BYTES, file.size))
        const signed = await requestJson<{ method: "PUT"; url: string }>(
          `/api/v1/local-media/multipart?${new URLSearchParams({
            key: upload.key,
            partNumber: String(partNumber),
            uploadId: upload.uploadId,
          })}`,
          "GET",
        )
        const response = await fetch(signed.url, { body: chunk, method: signed.method })
        if (!response.ok) throw new Error(`上传 ${file.name} 第 ${partNumber} 个分片失败。`)
        const etag = response.headers.get("ETag")
        if (!etag) throw new Error(`上传 ${file.name} 后未返回 ETag。`)
        parts.push({ ETag: etag, PartNumber: partNumber })
        completedBytes += chunk.size
        onProgress?.({
          completedBytes,
          fileIndex,
          fileProgress: ((offset + chunk.size) / file.size) * 100,
          totalBytes,
        })
        partNumber += 1
      }

      await requestJson(
        "/api/v1/local-media/multipart",
        "POST",
        { key: upload.key, parts, uploadId: upload.uploadId },
      )
      uploadedFiles.push({
        clientId,
        fileName: file.name,
        mimeType: file.type,
        objectKey: upload.key,
        size: file.size,
      })
    }
  } catch (error) {
    await abortUploads(plan)
    throw error
  }

  return { plan, uploadedFiles }
}

async function abortUploads(plan: LocalMediaUploadPlan) {
  await Promise.allSettled(
    plan.uploads.map((upload) =>
      requestJson("/api/v1/local-media/multipart", "DELETE", {
        key: upload.key,
        uploadId: upload.uploadId,
      }),
    ),
  )
}

async function requestJson<T = unknown>(path: string, method: "DELETE" | "GET" | "PATCH" | "POST", body?: unknown) {
  const response = await fetch(path, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
    credentials: "include",
    method,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "媒体上传失败。")
  }
  if (!payload?.data) throw new Error("媒体上传响应为空。")
  return payload.data
}
