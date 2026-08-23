import type {
  LocalMediaMultipartPlan,
  LocalMediaUploadSource,
  UploadedLocalMediaFile,
} from "@/domain/local-media-multipart"
import { apiRequest } from "@/features/api-client"

const MULTIPART_CHUNK_BYTES = 10 * 1024 * 1024

type UploadMeta = {
  clientId: string
}

type UploadBody = {
  key?: string
  location?: string
}

type LocalMediaUploadItem = {
  file: File
  source: LocalMediaUploadSource
  thumbnail?: File
}

export async function uploadLocalMediaMultipart(input: {
  files: File[]
  onProgress?: (progress: number, uploadedBytes: number, totalBytes: number) => void
  preparePath: string
  thumbnails?: Array<File | undefined>
}) {
  const [{ default: Uppy }, { default: AwsS3 }] = await Promise.all([
    import("@uppy/core"),
    import("@uppy/aws-s3"),
  ])
  const items = createUploadItems(input.files, input.thumbnails ?? [])
  const plan = await apiRequest<LocalMediaMultipartPlan>(input.preparePath, {
    method: "POST",
    body: JSON.stringify({ files: items.map((item) => item.source) }),
  })
  const sessions = new Map(plan.uploads.map((upload) => [upload.clientId, upload]))
  const totalBytes = items.reduce(
    (sum, item) => sum + item.file.size + (item.thumbnail?.size ?? 0),
    0,
  )
  const progressByClientId = new Map<string, number>()
  const uppy = new Uppy<UploadMeta, UploadBody>({
    autoProceed: false,
    allowMultipleUploadBatches: false,
    onBeforeFileAdded(file) {
      return { ...file, id: `local-media-${getFileClientId(file)}` }
    },
  })

  uppy.use(AwsS3, {
    shouldUseMultipart: true,
    getChunkSize: () => MULTIPART_CHUNK_BYTES,
    limit: 4,
    createMultipartUpload(file) {
      const session = getSession(sessions, getFileClientId(file))
      return { key: session.key, uploadId: session.uploadId }
    },
    listParts: async () => [],
    async signPart(file, { key, partNumber, uploadId }) {
      getSession(sessions, getFileClientId(file))
      const query = new URLSearchParams({
        key,
        uploadId,
        partNumber: String(partNumber),
      })
      return apiRequest<{ method: "PUT"; url: string }>(
        `/local-media/multipart?${query.toString()}`,
      )
    },
    completeMultipartUpload: async (_file, { key, parts, uploadId }) =>
      apiRequest<UploadBody>("/local-media/multipart", {
        method: "POST",
        body: JSON.stringify({ key, parts, uploadId }),
      }),
    abortMultipartUpload: async (_file, { key, uploadId }) => {
      if (!uploadId) return
      await abortMultipartUpload(key, uploadId)
    },
  })

  uppy.on("upload-progress", (file, progress) => {
    if (!file) return
    progressByClientId.set(file.meta.clientId, progress.bytesUploaded)
    const uploadedBytes = Array.from(progressByClientId.values()).reduce(
      (sum, value) => sum + value,
      0,
    )
    input.onProgress?.(
      totalBytes > 0 ? Math.min(100, (uploadedBytes / totalBytes) * 100) : 100,
      uploadedBytes,
      totalBytes,
    )
  })

  for (const item of items) {
    uppy.addFile({
      data: item.file,
      meta: { clientId: item.source.clientId },
      name: item.file.name,
      type: item.file.type || "application/octet-stream",
    })
    if (item.thumbnail && item.source.thumbnail) {
      uppy.addFile({
        data: item.thumbnail,
        meta: { clientId: item.source.thumbnail.clientId },
        name: item.thumbnail.name,
        type: item.thumbnail.type || "image/jpeg",
      })
    }
  }

  input.onProgress?.(0, 0, totalBytes)
  try {
    const result = await uppy.upload()
    const failure = result?.failed?.[0]?.error
    if (failure) throw failure
    input.onProgress?.(100, totalBytes, totalBytes)
  } catch (error) {
    uppy.cancelAll()
    await cleanupMultipartPlan(plan)
    throw normalizeUploadError(error)
  }

  return {
    cleanup: () => cleanupMultipartPlan(plan),
    resourceId: plan.resourceId,
    files: items.map((item) => toUploadedFile(item, sessions)),
  }
}

function createUploadItems(files: File[], thumbnails: Array<File | undefined>) {
  return files.map((file, index): LocalMediaUploadItem => {
    const thumbnail = thumbnails[index]
    return {
      file,
      thumbnail,
      source: {
        clientId: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        ...(thumbnail
          ? {
              thumbnail: {
                clientId: crypto.randomUUID(),
                fileName: thumbnail.name,
                mimeType: thumbnail.type,
                size: thumbnail.size,
              },
            }
          : {}),
      },
    }
  })
}

function toUploadedFile(
  item: LocalMediaUploadItem,
  sessions: Map<string, LocalMediaMultipartPlan["uploads"][number]>,
): UploadedLocalMediaFile {
  const upload = getSession(sessions, item.source.clientId)
  const thumbnailSource = item.source.thumbnail
  return {
    clientId: item.source.clientId,
    fileName: item.file.name,
    mimeType: item.file.type,
    objectKey: upload.key,
    size: item.file.size,
    ...(item.thumbnail && thumbnailSource
      ? {
          thumbnail: {
            clientId: thumbnailSource.clientId,
            mimeType: item.thumbnail.type,
            objectKey: getSession(sessions, thumbnailSource.clientId).key,
            size: item.thumbnail.size,
          },
        }
      : {}),
  }
}

function getSession(
  sessions: Map<string, LocalMediaMultipartPlan["uploads"][number]>,
  clientId: string,
) {
  const session = sessions.get(clientId)
  if (!session) throw new Error("上传会话无效，请重新上传。")
  return session
}

function getFileClientId(file: { meta: object }) {
  const clientId = (file.meta as { clientId?: unknown }).clientId
  if (typeof clientId !== "string") throw new Error("上传会话无效，请重新上传。")
  return clientId
}

async function cleanupMultipartPlan(plan: LocalMediaMultipartPlan) {
  await Promise.allSettled(
    plan.uploads.map((upload) => abortMultipartUpload(upload.key, upload.uploadId)),
  )
}

async function abortMultipartUpload(key: string, uploadId: string) {
  await apiRequest("/local-media/multipart", {
    method: "DELETE",
    body: JSON.stringify({ key, uploadId }),
  })
}

function normalizeUploadError(error: unknown) {
  if (error instanceof Error && error.message !== "Non 2xx") return error
  return new Error("上传分片失败，请检查网络后重试。")
}
