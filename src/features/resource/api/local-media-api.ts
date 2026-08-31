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
const MULTIPART_SIGN_BATCH_SIZE = 8
const MULTIPART_UPLOAD_CONCURRENCY = 4

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
      const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_BYTES)
      let nextPartNumber = 1
      let uploadedFileBytes = 0
      while (nextPartNumber <= totalParts) {
        const partNumbers = Array.from(
          { length: Math.min(MULTIPART_SIGN_BATCH_SIZE, totalParts - nextPartNumber + 1) },
          (_, index) => nextPartNumber + index,
        )
        const signedParts = await requestJson<Array<{
          key: string
          parts: Array<{ method: "PUT"; partNumber: number; url: string }>
          uploadId: string
        }>>("/api/v1/local-media/multipart/sign", "POST", {
          uploads: [{ key: upload.key, partNumbers, uploadId: upload.uploadId }],
        })
        const signed = signedParts[0]
        if (!signed || signed.key !== upload.key || signed.uploadId !== upload.uploadId) {
          throw new Error(`未找到文件 ${file.name} 的分片签名。`)
        }

        for (let offset = 0; offset < signed.parts.length; offset += MULTIPART_UPLOAD_CONCURRENCY) {
          const concurrentParts = signed.parts.slice(offset, offset + MULTIPART_UPLOAD_CONCURRENCY)
          const completed = await Promise.all(
            concurrentParts.map(async (signedPart) => {
              const partOffset = (signedPart.partNumber - 1) * MULTIPART_CHUNK_BYTES
              const chunk = file.slice(partOffset, Math.min(partOffset + MULTIPART_CHUNK_BYTES, file.size))
              const response = await fetch(signedPart.url, { body: chunk, method: signedPart.method })
              if (!response.ok) throw new Error(`上传 ${file.name} 第 ${signedPart.partNumber} 个分片失败。`)
              const etag = response.headers.get("ETag")
              if (!etag) throw new Error(`上传 ${file.name} 后未返回 ETag。`)
              return { ETag: etag, PartNumber: signedPart.partNumber, size: chunk.size }
            }),
          )
          completed.forEach((part) => {
            parts.push({ ETag: part.ETag, PartNumber: part.PartNumber })
            uploadedFileBytes += part.size
            completedBytes += part.size
          })
          onProgress?.({
            completedBytes,
            fileIndex,
            fileProgress: (uploadedFileBytes / file.size) * 100,
            totalBytes,
          })
        }
        nextPartNumber += signed.parts.length
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
