import { z } from "zod"

export const resourceTypeSchema = z.enum([
  "magnet",
  "twitter",
  "telegram",
  "douyin",
  "wechat_mp",
  "gofile",
  "baidu_pan",
  "pan_115",
  "pan_123",
  "quark_pan",
  "uc_pan",
  "xunlei_pan",
  "pikpak",
  "onedrive",
  "google_drive",
  "dropbox",
  "alist",
  "ftp",
  "http",
  "youtube",
  "local_media",
  "other",
])

export const createResourceSchema = z.object({
  vaultId: z.string().trim().min(1).optional(),
  spaceId: z.string().trim().min(1).optional(),
  type: resourceTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().optional().default(""),
  extractionCode: z.string().trim().max(200).optional(),
  url: z.string().trim().min(1).max(4096),
  referer: z.string().trim().max(4096).optional(),
})

export const createResourceWithVaultSchema = createResourceSchema.extend({
  vaultId: z.string().trim().min(1),
})

export const updateResourceSchema = z
  .object({
    spaceId: z.string().trim().min(1).nullable().optional(),
    type: resourceTypeSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().optional(),
    url: z.string().trim().min(1).max(2048).optional(),
    referer: z.string().trim().max(4096).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  })

export const reorderResourcesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      spaceId: z.string().trim().min(1),
      position: z.number().int().min(0),
    })
  ).min(1),
})

export const transferResourceSchema = z.object({
  action: z.enum(["move", "copy"]),
  targetVaultId: z.string().trim().min(1),
  targetSpaceId: z.string().trim().min(1),
})

export const transferResourcesSchema = transferResourceSchema.extend({
  resourceIds: z.array(z.string().trim().min(1)).min(1).max(100),
})

export const updateResourceAnnotationSchema = z
  .object({
    checked: z.boolean().optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    comment: z.string().max(5000).optional(),
    dataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  })
