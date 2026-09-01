import { and, eq } from "drizzle-orm"

import { resourceMetadata, resources } from "../db/schema"
import type {
  LocalMediaMultipartPlan,
  LocalMediaUploadSource,
  UploadedLocalMediaFile,
} from "../domain/local-media-multipart"
import {
  createMediaProxyUrl,
  LOCAL_MEDIA_OBJECT_PREFIX,
  LOCAL_MEDIA_PROVIDER,
} from "../domain/media-storage"
import {
  createBaseResourceMetadata,
  type ResourceFileType,
  type ResourceMediaMetadata,
} from "../domain/resources/metadata"
import { ApiError } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import { requireVaultPermission } from "./permission-service"
import {
  abortS3MultipartUpload,
  completeS3MultipartUpload,
  createS3MultipartUpload,
  deleteS3Object,
  headS3Object,
  signS3MultipartPart,
} from "./s3-multipart-service"
import {
  ensureResourceUrlNotDuplicate,
  getDuplicateResourceKey,
  getNextResourcePosition,
} from "./resource-service"
import { getDefaultSpaceId, getSpaceInVaultOrThrow } from "./space-service"
import { ensureActorUser } from "./user-service"
import { getVaultOrThrow } from "./vault-service"
import { newId } from "../lib/id"

const MAX_MEDIA_FILES = 20
const MAX_MEDIA_FILE_BYTES = 1024 * 1024 * 1024
const MAX_MEDIA_UPLOAD_BYTES = 1024 * 1024 * 1024
const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024

type ValidatedUploadSource = Omit<LocalMediaUploadSource, "thumbnail"> & {
  fileType: ResourceFileType
  kind: ResourceMediaMetadata["kind"]
  thumbnail?: NonNullable<LocalMediaUploadSource["thumbnail"]>
}

type UploadedMedia = Omit<UploadedLocalMediaFile, "thumbnail"> & {
  fileType: ResourceFileType
  kind: ResourceMediaMetadata["kind"]
  thumbnail?: NonNullable<UploadedLocalMediaFile["thumbnail"]>
}

type StoredMedia = {
  fileName: string
  fileType: ResourceFileType
  kind: ResourceMediaMetadata["kind"]
  mimeType: string
  objectKey: string
  size: number
  thumbnailObjectKey?: string
  thumbnailUrl?: string
  url: string
}

export function isResourceMediaUploadEnabled(env?: Partial<CloudflareEnv>) {
  const value = (env as Record<string, unknown> | undefined)?.ALLOW_RESOURCE_MEDIA_UPLOAD
  return typeof value === "string" && value.trim().toLowerCase() === "true"
}

export async function prepareUploadedMediaResource(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
    env: CloudflareEnv
    files: LocalMediaUploadSource[]
  },
): Promise<LocalMediaMultipartPlan> {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "resource:create",
  })

  const files = validateUploadSources(input.files)
  const resourceId = newId()
  const uploads = await createMultipartUploadPlan(input.env, {
    actor: input.actor,
    files,
    resourceId,
    vaultId,
    mode: "create",
  })

  return { resourceId, uploads }
}

export async function prepareUpdatedMediaResource(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
    env: CloudflareEnv
    files: LocalMediaUploadSource[]
  },
): Promise<LocalMediaMultipartPlan> {
  const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1)
  if (!resource || resource.type !== "local_media") {
    throw new ApiError("NOT_FOUND", "本地媒体资源不存在。", 404)
  }
  await requireVaultPermission(db, {
    vaultId: resource.vaultId,
    actor: input.actor,
    action: "resource:update",
  })

  const files = validateUploadSources(input.files)
  const uploads = await createMultipartUploadPlan(input.env, {
    actor: input.actor,
    files,
    resourceId,
    vaultId: resource.vaultId,
    mode: "update",
  })

  return { resourceId, uploads }
}

export async function signResourceMediaPart(
  env: CloudflareEnv,
  input: {
    actor: Actor
    key: string
    partNumber: number
    uploadId: string
  },
) {
  assertActorUploadKey(input.actor, input.key)
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10_000) {
    throw new ApiError("VALIDATION_ERROR", "上传分片编号无效。", 422)
  }

  return signS3MultipartPart(env, input)
}

export async function signResourceMediaParts(
  env: CloudflareEnv,
  input: {
    actor: Actor
    uploads: Array<{
      key: string
      partNumbers: number[]
      uploadId: string
    }>
  },
) {
  const uploads = input.uploads.map((upload) => {
    assertActorUploadKey(input.actor, upload.key)
    if (
      upload.partNumbers.length === 0 ||
      new Set(upload.partNumbers).size !== upload.partNumbers.length ||
      upload.partNumbers.some(
        (partNumber) => !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000,
      )
    ) {
      throw new ApiError("VALIDATION_ERROR", "上传分片编号无效。", 422)
    }
    return upload
  })

  return Promise.all(
    uploads.map(async (upload) => ({
      key: upload.key,
      uploadId: upload.uploadId,
      parts: await Promise.all(
        upload.partNumbers.map(async (partNumber) => ({
          partNumber,
          ...(await signS3MultipartPart(env, {
            key: upload.key,
            partNumber,
            uploadId: upload.uploadId,
          })),
        })),
      ),
    })),
  )
}

export async function completeResourceMediaUpload(
  env: CloudflareEnv,
  input: {
    actor: Actor
    key: string
    parts: Array<{ ETag: string; PartNumber: number }>
    uploadId: string
  },
) {
  assertActorUploadKey(input.actor, input.key)
  if (
    input.parts.length === 0 ||
    new Set(input.parts.map((part) => part.PartNumber)).size !== input.parts.length ||
    input.parts.some(
      (part) =>
        !Number.isInteger(part.PartNumber) ||
        part.PartNumber < 1 ||
        part.PartNumber > 10_000 ||
        !part.ETag.trim(),
    )
  ) {
    throw new ApiError("VALIDATION_ERROR", "上传分片列表无效。", 422)
  }

  const existing = await env.MEDIA.head(input.key)
  if (
    existing?.customMetadata?.actorid === input.actor.id &&
    existing.customMetadata.provider === LOCAL_MEDIA_PROVIDER
  ) {
    return { key: existing.key, location: createMediaProxyUrl(existing.key) }
  }

  const parts = [...input.parts].sort((left, right) => left.PartNumber - right.PartNumber)
  await completeS3MultipartUpload(env, { ...input, parts })

  return { key: input.key, location: createMediaProxyUrl(input.key) }
}

export async function abortResourceMediaUpload(
  db: Db,
  env: CloudflareEnv,
  input: { actor: Actor; key: string; uploadId: string },
) {
  assertActorUploadKey(input.actor, input.key)
  const referenced = await isStoredMediaObjectKey(db, input.key)
  await Promise.allSettled([
    abortS3MultipartUpload(env, input),
    ...(referenced
      ? []
      : [env.MEDIA.delete(input.key), deleteS3Object(env, input.key)]),
  ])
}

export async function createUploadedMediaResource(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
    description?: string
    env: CloudflareEnv
    files: UploadedLocalMediaFile[]
    media: R2Bucket
    referer?: string
    resourceId: string
    spaceId?: string
    title?: string
  },
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "resource:create",
  })

  const [existingResource] = await db
    .select()
    .from(resources)
    .where(eq(resources.id, input.resourceId))
    .limit(1)
  if (existingResource) {
    if (
      existingResource.vaultId === vaultId &&
      existingResource.type === "local_media" &&
      existingResource.createdBy === input.actor.id
    ) {
      return { id: input.resourceId, metadataStatus: "completed" as const }
    }
    throw new ApiError("CONFLICT", "上传资源 ID 已被占用。", 409)
  }

  const files = validateCompletedUploads(input.files)
  await verifyCompletedUploads(input.media, {
    actor: input.actor,
    env: input.env,
    files,
    resourceId: input.resourceId,
    vaultId,
  })

  const createdBy = await ensureActorUser(db, input.actor)
  const spaceId = input.spaceId
    ? (await getSpaceInVaultOrThrow(db, vaultId, input.spaceId)).id
    : await getDefaultSpaceId(db, vaultId)
  const dedupeKey = getDuplicateResourceKey(`local_media:${input.resourceId}`)
  const title = getResourceTitle(input.title, files)
  const description = input.description?.trim() ?? ""
  const position = await getNextResourcePosition(db, spaceId)
  const storedMedia = files.map(toStoredUploadedMedia)
  const metadata = buildLocalMediaMetadata({ description }, storedMedia)
  const uploadedKeys = getUploadedObjectKeys(files)

  await ensureResourceUrlNotDuplicate(db, vaultId, dedupeKey)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(resources).values({
        id: input.resourceId,
        vaultId,
        spaceId,
        type: "local_media",
        title,
        description,
        url: null,
        referer: input.referer?.trim() || null,
        dedupeKey,
        metadataStatus: "completed",
        position,
        createdBy,
      })
      await tx.insert(resourceMetadata).values({
        resourceId: input.resourceId,
        provider: LOCAL_MEDIA_PROVIDER,
        status: "completed",
        dataJson: metadata,
      })
    })
  } catch (error) {
    await deleteStoredMediaObjects(input.env, input.media, uploadedKeys)
    throw error
  }

  return {
    id: input.resourceId,
    metadataStatus: "completed" as const,
  }
}

export async function updateUploadedMediaResource(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
    description?: string
    env: CloudflareEnv
    files: UploadedLocalMediaFile[]
    media: R2Bucket
    order: string[]
    referer?: string
    spaceId?: string
    title?: string
  },
) {
  const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1)
  if (!resource || resource.type !== "local_media") {
    throw new ApiError("NOT_FOUND", "本地媒体资源不存在。", 404)
  }
  await requireVaultPermission(db, {
    vaultId: resource.vaultId,
    actor: input.actor,
    action: "resource:update",
  })

  const [metadataRow] = await db
    .select()
    .from(resourceMetadata)
    .where(
      and(
        eq(resourceMetadata.resourceId, resourceId),
        eq(resourceMetadata.provider, LOCAL_MEDIA_PROVIDER),
      ),
    )
    .limit(1)
  const existing = getStoredMedia(metadataRow?.dataJson)
  const uploaded = validateCompletedUploads(input.files, true)
  await verifyCompletedUploads(input.media, {
    actor: input.actor,
    env: input.env,
    files: uploaded,
    resourceId,
    vaultId: resource.vaultId,
  })

  const newItems = uploaded.map((item, index) => ({
    ...toStoredUploadedMedia(item),
    id: `new:${index}`,
  }))
  const uploadedObjectKeys = new Set(newItems.map((item) => item.objectKey))
  const candidates = new Map<string, StoredMedia & { id?: string }>([
    ...existing
      .filter((item) => !uploadedObjectKeys.has(item.objectKey))
      .map((item) => [item.objectKey, item] as const),
    ...newItems.map((item) => [item.id, item] as const),
  ])
  if (
    input.order.length === 0 ||
    new Set(input.order).size !== input.order.length ||
    input.order.length !== candidates.size ||
    input.order.some((id) => !candidates.has(id))
  ) {
    throw new ApiError("VALIDATION_ERROR", "媒体顺序无效。", 422)
  }

  const nextMedia = input.order.map((id) => candidates.get(id)!)
  const newObjectKeys = getUploadedObjectKeys(uploaded)
  try {
    const nextMetadata = buildLocalMediaMetadata(input, nextMedia)
    await db.transaction(async (tx) => {
      await tx
        .update(resources)
        .set({
          title: getResourceTitle(input.title, nextMedia),
          description: input.description?.trim() ?? "",
          referer: input.referer?.trim() || null,
          updatedAt: new Date().toISOString(),
          ...(input.spaceId ? { spaceId: input.spaceId } : {}),
        })
        .where(eq(resources.id, resourceId))
      await tx
        .update(resourceMetadata)
        .set({ dataJson: nextMetadata, updatedAt: new Date().toISOString() })
        .where(eq(resourceMetadata.resourceId, resourceId))
    })
  } catch (error) {
    await deleteStoredMediaObjects(input.env, input.media, newObjectKeys)
    throw error
  }

  const retainedKeys = new Set(
    nextMedia.flatMap((item) => [item.objectKey, item.thumbnailObjectKey].filter(Boolean)),
  )
  const removedKeys = existing.flatMap((item) =>
    [item.objectKey, item.thumbnailObjectKey].filter(
      (key): key is string => Boolean(key) && !retainedKeys.has(key),
    ),
  )
  await deleteStoredMediaObjects(input.env, input.media, removedKeys)

  return { id: resourceId, metadataStatus: "completed" as const }
}

async function deleteStoredMediaObjects(
  env: CloudflareEnv,
  media: R2Bucket,
  keys: string[],
) {
  await Promise.allSettled(
    keys.flatMap((key) => [media.delete(key), deleteS3Object(env, key)]),
  )
}

async function createMultipartUploadPlan(
  env: CloudflareEnv,
  input: {
    actor: Actor
    files: ValidatedUploadSource[]
    mode: "create" | "update"
    resourceId: string
    vaultId: string
  },
) {
  const created: Array<{ key: string; uploadId: string }> = []

  try {
    const results = await Promise.allSettled(
      input.files.map(async (file, index) => {
        const objectKey =
          input.mode === "create"
            ? `${getActorResourcePrefix(input.actor, input.resourceId)}${getObjectFileName(file.fileName, index)}`
            : `${getActorResourcePrefix(input.actor, input.resourceId)}media/${newId()}.${getFileExtension(file.fileName) ?? "bin"}`
        const uploads = [
          createS3MultipartUpload(env, {
            key: objectKey,
            contentType: file.mimeType,
            customMetadata: getMultipartMetadata(input, file.clientId, "media"),
          }),
        ]
        if (file.thumbnail) {
          const thumbnailKey = `${getActorResourcePrefix(input.actor, input.resourceId)}thumbnails/${newId()}.jpg`
          uploads.push(
            createS3MultipartUpload(env, {
              key: thumbnailKey,
              contentType: file.thumbnail.mimeType,
              customMetadata: getMultipartMetadata(
                input,
                file.thumbnail.clientId,
                "thumbnail",
              ),
            }),
          )
        }
        const fileResults = await Promise.allSettled(uploads)
        const fulfilled = fileResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        )
        const rejected = fileResults.find((result) => result.status === "rejected")
        if (rejected) {
          await Promise.allSettled(fulfilled.map((upload) => abortS3MultipartUpload(env, upload)))
          throw rejected.reason
        }
        return fulfilled
      }),
    )
    created.push(
      ...results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    )
    const rejected = results.find((result) => result.status === "rejected")
    if (rejected) throw rejected.reason
  } catch (error) {
    await Promise.allSettled(created.map((upload) => abortS3MultipartUpload(env, upload)))
    throw error
  }

  return created.map((upload, index) => ({
    clientId: getUploadClientIds(input.files)[index]!,
    key: upload.key,
    uploadId: upload.uploadId,
  }))
}

function getMultipartMetadata(
  input: { actor: Actor; resourceId: string; vaultId: string },
  clientId: string,
  role: "media" | "thumbnail",
): Record<string, string> {
  return {
    actorid: input.actor.id,
    clientid: clientId,
    provider: LOCAL_MEDIA_PROVIDER,
    resourceid: input.resourceId,
    role,
    vaultid: input.vaultId,
  }
}

function getUploadClientIds(files: ValidatedUploadSource[]) {
  return files.flatMap((file) => [file.clientId, file.thumbnail?.clientId].filter(Boolean)) as string[]
}

async function verifyCompletedUploads(
  media: R2Bucket,
  input: {
    actor: Actor
    env: CloudflareEnv
    files: UploadedMedia[]
    resourceId: string
    vaultId: string
  },
) {
  if (!input.resourceId.trim()) {
    throw new ApiError("VALIDATION_ERROR", "上传资源 ID 无效。", 422)
  }

  await Promise.all(
    input.files.flatMap((file) => [
      verifyCompletedObject(media, {
        actor: input.actor,
        clientId: file.clientId,
        env: input.env,
        key: file.objectKey,
        mimeType: file.mimeType,
        resourceId: input.resourceId,
        role: "media",
        size: file.size,
        vaultId: input.vaultId,
      }),
      ...(file.thumbnail
        ? [
            verifyCompletedObject(media, {
              actor: input.actor,
              clientId: file.thumbnail.clientId,
              env: input.env,
              key: file.thumbnail.objectKey,
              mimeType: file.thumbnail.mimeType,
              resourceId: input.resourceId,
              role: "thumbnail",
              size: file.thumbnail.size,
              vaultId: input.vaultId,
            }),
          ]
        : []),
    ]),
  )
}

async function verifyCompletedObject(
  media: R2Bucket,
  input: {
    actor: Actor
    clientId: string
    env: CloudflareEnv
    key: string
    mimeType: string
    resourceId: string
    role: "media" | "thumbnail"
    size: number
    vaultId: string
  },
) {
  assertActorUploadKey(input.actor, input.key)
  const object = await media.head(input.key)
  const remoteObject = object ? null : await headS3Object(input.env, input.key)
  const metadata = object?.customMetadata ?? remoteObject?.customMetadata
  const size = object?.size ?? remoteObject?.size
  const contentType =
    object?.httpMetadata?.contentType ?? remoteObject?.httpMetadata.contentType
  if (
    (!object && !remoteObject) ||
    size !== input.size ||
    contentType !== input.mimeType ||
    metadata?.actorid !== input.actor.id ||
    metadata?.clientid !== input.clientId ||
    metadata?.provider !== LOCAL_MEDIA_PROVIDER ||
    metadata?.resourceid !== input.resourceId ||
    metadata?.role !== input.role ||
    metadata?.vaultid !== input.vaultId
  ) {
    throw new ApiError("VALIDATION_ERROR", "上传媒体校验失败，请重新上传。", 422)
  }
}

function validateUploadSources(files: LocalMediaUploadSource[]) {
  return validateMediaInputs(files, (file) => ({
    ...file,
    fileName: getDisplayFileName(file.fileName),
    mimeType: getMimeType(file.mimeType, file.fileName),
  }))
}

function validateCompletedUploads(files: UploadedLocalMediaFile[], allowEmpty = false) {
  return validateMediaInputs(files, (file) => ({
    ...file,
    fileName: getDisplayFileName(file.fileName),
    mimeType: getMimeType(file.mimeType, file.fileName),
  }), allowEmpty)
}

function validateMediaInputs<
  T extends {
    clientId: string
    fileName: string
    mimeType: string
    size: number
    thumbnail?: { clientId: string; mimeType: string; size: number }
  },
  R extends T,
>(files: T[], normalize: (file: T) => R, allowEmpty = false) {
  if (files.length === 0 && !allowEmpty) {
    throw new ApiError("VALIDATION_ERROR", "请至少选择一个媒体文件。", 422)
  }
  if (files.length > MAX_MEDIA_FILES) {
    throw new ApiError("VALIDATION_ERROR", `一次最多上传 ${MAX_MEDIA_FILES} 个媒体文件。`, 422)
  }

  let totalSize = 0
  const clientIds = new Set<string>()
  return files.map((source) => {
    const file = normalize(source)
    if (!file.clientId.trim() || clientIds.has(file.clientId)) {
      throw new ApiError("VALIDATION_ERROR", "媒体文件标识无效。", 422)
    }
    clientIds.add(file.clientId)
    if (file.size <= 0) {
      throw new ApiError("VALIDATION_ERROR", `${file.fileName || "媒体文件"} 为空。`, 422)
    }
    if (file.size > MAX_MEDIA_FILE_BYTES) {
      throw new ApiError("VALIDATION_ERROR", `${file.fileName || "媒体文件"} 超过 1 GB 限制。`, 422)
    }

    totalSize += file.size
    const kind = getMediaKind(file.mimeType)
    if (kind === "unknown") {
      throw new ApiError("VALIDATION_ERROR", "仅支持常见的图片、视频、音频和压缩文件。", 422)
    }

    if (file.thumbnail) {
      if (kind !== "video") {
        throw new ApiError("VALIDATION_ERROR", "只有视频文件可以附带预览图。", 422)
      }
      if (!file.thumbnail.clientId.trim() || clientIds.has(file.thumbnail.clientId)) {
        throw new ApiError("VALIDATION_ERROR", "视频预览图标识无效。", 422)
      }
      clientIds.add(file.thumbnail.clientId)
      if (
        file.thumbnail.size <= 0 ||
        file.thumbnail.size > MAX_THUMBNAIL_BYTES ||
        !file.thumbnail.mimeType.trim().toLowerCase().startsWith("image/")
      ) {
        throw new ApiError("VALIDATION_ERROR", "视频预览图必须是小于 10 MB 的图片文件。", 422)
      }
      totalSize += file.thumbnail.size
    }
    if (totalSize > MAX_MEDIA_UPLOAD_BYTES) {
      throw new ApiError("VALIDATION_ERROR", "单次上传的媒体总大小不能超过 1 GB。", 422)
    }

    return {
      ...file,
      fileType: getFileType(kind),
      kind,
    }
  })
}

function getStoredMedia(data: unknown): StoredMedia[] {
  const media = data && typeof data === "object" ? (data as { media?: unknown }).media : []
  if (!Array.isArray(media)) return []

  return media.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const value = item as Record<string, unknown>
    const metadata = value.metadata as Record<string, unknown> | undefined
    const objectKey = metadata?.objectKey
    if (
      typeof objectKey !== "string" ||
      typeof value.url !== "string" ||
      typeof value.kind !== "string" ||
      typeof value.mimeType !== "string" ||
      typeof value.fileName !== "string" ||
      typeof value.size !== "number"
    ) {
      return []
    }

    const kind = value.kind as ResourceMediaMetadata["kind"]
    return [
      {
        objectKey,
        thumbnailObjectKey:
          typeof metadata?.thumbnailObjectKey === "string"
            ? metadata.thumbnailObjectKey
            : undefined,
        url: value.url,
        thumbnailUrl:
          typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined,
        kind,
        mimeType: value.mimeType,
        fileName: value.fileName,
        size: value.size,
        fileType: getFileType(kind),
      },
    ]
  })
}

async function isStoredMediaObjectKey(db: Db, key: string) {
  const resourceId = key.slice(LOCAL_MEDIA_OBJECT_PREFIX.length).split("/")[1]
  if (!resourceId) return false

  const [metadataRow] = await db
    .select()
    .from(resourceMetadata)
    .where(
      and(
        eq(resourceMetadata.resourceId, resourceId),
        eq(resourceMetadata.provider, LOCAL_MEDIA_PROVIDER),
      ),
    )
    .limit(1)
  return getStoredMedia(metadataRow?.dataJson).some(
    (item) => item.objectKey === key || item.thumbnailObjectKey === key,
  )
}

function toStoredUploadedMedia(item: UploadedMedia): StoredMedia {
  return {
    objectKey: item.objectKey,
    thumbnailObjectKey: item.thumbnail?.objectKey,
    url: createMediaProxyUrl(item.objectKey),
    thumbnailUrl:
      item.kind === "image"
        ? createMediaProxyUrl(item.objectKey)
        : item.thumbnail
          ? createMediaProxyUrl(item.thumbnail.objectKey)
          : undefined,
    kind: item.kind,
    mimeType: item.mimeType,
    fileName: item.fileName,
    size: item.size,
    fileType: item.fileType,
  }
}

function buildLocalMediaMetadata(input: { description?: string }, media: StoredMedia[]) {
  const now = new Date().toISOString()
  return {
    ...createBaseResourceMetadata({ type: "local_media", fetchedAt: now }),
    description: input.description?.trim() ?? "",
    size: media.reduce((sum, item) => sum + item.size, 0),
    fileCount: media.length,
    fileType: getSharedFileType(media),
    tree: media.map((item) => ({
      name: item.fileName,
      size: item.size,
      type: item.fileType,
    })),
    source: { name: LOCAL_MEDIA_PROVIDER },
    media: media.map((item) => ({
      kind: item.kind,
      provider: LOCAL_MEDIA_PROVIDER,
      sourceId: item.objectKey,
      url: item.url,
      ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
      mimeType: item.mimeType,
      fileName: item.fileName,
      size: item.size,
      metadata: {
        objectKey: item.objectKey,
        ...(item.thumbnailObjectKey
          ? { thumbnailObjectKey: item.thumbnailObjectKey }
          : {}),
      },
    })),
  }
}

function getUploadedObjectKeys(files: UploadedMedia[]) {
  return files.flatMap((file) => [file.objectKey, file.thumbnail?.objectKey].filter(Boolean)) as string[]
}

function getResourceTitle(title: string | undefined, files: Array<{ fileName: string }>) {
  const value = title?.trim().slice(0, 200)
  if (value) return value
  if (files.length === 1) return files[0]!.fileName.slice(0, 200)
  return `${files.length} 个媒体文件`
}

function getSharedFileType(files: Array<{ fileType: ResourceFileType }>): ResourceFileType {
  const [first] = files
  return first && files.every((file) => file.fileType === first.fileType)
    ? first.fileType
    : "unknown"
}

function assertActorUploadKey(actor: Actor, key: string) {
  if (!key.startsWith(`${LOCAL_MEDIA_OBJECT_PREFIX}${actor.id}/`)) {
    throw new ApiError("FORBIDDEN", "无权访问该上传任务。", 403)
  }
}

function getActorResourcePrefix(actor: Actor, resourceId: string) {
  return `${LOCAL_MEDIA_OBJECT_PREFIX}${actor.id}/${resourceId}/`
}

function getDisplayFileName(value: string) {
  const name = Array.from(value.trim())
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
  return name.slice(0, 240) || "media"
}

function getObjectFileName(fileName: string, index: number) {
  const extension = getFileExtension(fileName)
  return extension ? `${index + 1}.${extension}` : `${index + 1}`
}

function getFileExtension(fileName: string) {
  return fileName.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase()
}

function getMimeType(value: string, fileName: string) {
  const type = value.trim().toLowerCase()
  const extension = getFileExtension(fileName)
  const fallbackTypes: Record<string, string> = {
    avif: "image/avif",
    bmp: "image/bmp",
    flac: "audio/flac",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    m4a: "audio/mp4",
    m4v: "video/x-m4v",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/opus",
    png: "image/png",
    tiff: "image/tiff",
    tif: "image/tiff",
    wav: "audio/wav",
    webm: "video/webm",
    webp: "image/webp",
    aac: "audio/aac",
    avi: "video/x-msvideo",
    "7z": "application/x-7z-compressed",
    bz2: "application/x-bzip2",
    gz: "application/gzip",
    iso: "application/x-iso9660-image",
    rar: "application/vnd.rar",
    tar: "application/x-tar",
    tbz: "application/x-bzip2",
    tgz: "application/gzip",
    txz: "application/x-xz",
    xz: "application/x-xz",
    zip: "application/zip",
  }

  const fallbackType = extension ? fallbackTypes[extension] : undefined
  if (type && type !== "application/octet-stream") return type.split(";", 1)[0]!
  return fallbackType ?? (type ? type.split(";", 1)[0]! : "application/octet-stream")
}

function getMediaKind(mimeType: string): ResourceMediaMetadata["kind"] {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (isArchiveMimeType(mimeType)) return "document"
  return "unknown"
}

function isArchiveMimeType(mimeType: string) {
  return [
    "application/gzip",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/x-bzip2",
    "application/x-gzip",
    "application/x-iso9660-image",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/x-xz",
    "application/x-zip-compressed",
    "application/zip",
  ].includes(mimeType)
}

function getFileType(kind: ResourceMediaMetadata["kind"]): ResourceFileType {
  if (kind === "image" || kind === "video" || kind === "audio") return kind
  if (kind === "document") return "archive"
  return "unknown"
}
