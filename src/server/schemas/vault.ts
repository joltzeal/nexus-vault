import { z } from "zod"
import { resourceTypeSchema } from "@/server/schemas/resource"

export const visibilitySchema = z.enum(["public", "private", "password"])
const metadataStatusSchema = z.enum(["pending", "processing", "completed", "failed"])

export const createVaultSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().optional().default(""),
  cover: z.string().trim().max(500).optional().default(""),
  visibility: visibilitySchema.optional().default("private"),
  collectionEnabled: z.boolean().optional().default(false),
})

export const updateVaultSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().optional(),
    cover: z.string().trim().max(500).optional(),
    visibility: visibilitySchema.optional(),
    collectionEnabled: z.boolean().optional(),
    nsfwEnabled: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  })

export const updateShareSchema = z.object({
  visibility: visibilitySchema,
  passwordHash: z.string().trim().min(1).nullable().optional(),
})

export const unlockShareSchema = z.object({
  passwordHash: z.string().trim().min(1),
  turnstileToken: z.string().trim().min(1).optional(),
})

export const starSchema = z.object({
  userName: z.string().trim().max(120).optional(),
})

export const vaultExportResourceMetadataSchema = z
  .object({
    provider: z.string().trim().min(1).max(80).optional().default("import"),
    status: metadataStatusSchema.optional().default("completed"),
    data: z.unknown().optional(),
    errorMessage: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .nullable()
  .optional()

export const vaultExportSchema = z.object({
  format: z.literal("nexus-vault.v1"),
  exportedAt: z.string().optional(),
  vault: z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().optional().default(""),
    cover: z.string().max(500).optional().default(""),
    visibility: visibilitySchema.optional().default("private"),
    collectionEnabled: z.boolean().optional().default(false),
    nsfwEnabled: z.boolean().optional().default(true),
  }),
  spaces: z.array(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1).max(80),
      description: z.string().optional().default(""),
      icon: z.string().trim().min(1).max(32).optional().default("tv"),
      position: z.number().int().min(0).optional().default(0),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })
  ),
  resources: z.array(
    z.object({
      id: z.string().trim().min(1),
      spaceId: z.string().trim().min(1).nullable().optional(),
      type: resourceTypeSchema,
      title: z.string().trim().min(1).max(200),
      description: z.string().optional().default(""),
      url: z.string().trim().min(1).max(4096),
      metadataStatus: metadataStatusSchema.optional().default("completed"),
      position: z.number().int().min(0).optional().default(0),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      metadata: vaultExportResourceMetadataSchema,
    })
  ),
})

export const importVaultSchema = z.object({
  data: vaultExportSchema,
})

export type VaultExportPayload = z.infer<typeof vaultExportSchema>
