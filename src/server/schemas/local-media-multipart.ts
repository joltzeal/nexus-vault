import { z } from "zod"

const clientIdSchema = z.string().trim().min(1).max(200)
const fileNameSchema = z.string().trim().min(1).max(1000)
const mimeTypeSchema = z.string().trim().max(200)
const objectKeySchema = z.string().trim().min(1).max(2000)

const thumbnailSourceSchema = z.object({
  clientId: clientIdSchema,
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  size: z.number().int().positive(),
})

export const localMediaUploadSourceSchema = z.object({
  clientId: clientIdSchema,
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  size: z.number().int().positive(),
  thumbnail: thumbnailSourceSchema.optional(),
})

const uploadedThumbnailSchema = z.object({
  clientId: clientIdSchema,
  mimeType: mimeTypeSchema,
  objectKey: objectKeySchema,
  size: z.number().int().positive(),
})

export const uploadedLocalMediaFileSchema = z.object({
  clientId: clientIdSchema,
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  objectKey: objectKeySchema,
  size: z.number().int().positive(),
  thumbnail: uploadedThumbnailSchema.optional(),
})

export const prepareLocalMediaMultipartSchema = z.object({
  files: z.array(localMediaUploadSourceSchema).min(1).max(20),
})

const localMediaResourceFieldsSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().optional(),
  referer: z.string().trim().max(4096).optional(),
  spaceId: z.string().trim().min(1).optional(),
})

export const createUploadedLocalMediaSchema = localMediaResourceFieldsSchema.extend({
  resourceId: z.uuid(),
  files: z.array(uploadedLocalMediaFileSchema).min(1).max(20),
})

export const updateUploadedLocalMediaSchema = localMediaResourceFieldsSchema.extend({
  files: z.array(uploadedLocalMediaFileSchema).max(20),
  order: z.array(z.string().trim().min(1)).min(1).max(40),
})

export const completeLocalMediaMultipartSchema = z.object({
  key: objectKeySchema,
  uploadId: z.string().trim().min(1).max(1000),
  parts: z
    .array(
      z.object({
        ETag: z.string().trim().min(1).max(1000),
        PartNumber: z.number().int().min(1).max(10_000),
      }),
    )
    .min(1)
    .max(10_000),
})

export const abortLocalMediaMultipartSchema = completeLocalMediaMultipartSchema.pick({
  key: true,
  uploadId: true,
})
