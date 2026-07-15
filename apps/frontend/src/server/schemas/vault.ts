import { z } from "zod"

export const visibilitySchema = z.enum(["public", "private", "password"])

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
})

export const starSchema = z.object({
  userName: z.string().trim().max(120).optional(),
})
