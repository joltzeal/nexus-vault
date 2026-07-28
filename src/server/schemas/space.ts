import { z } from "zod"

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().optional().default(""),
  icon: z.string().trim().min(1).max(32).optional().default("tv"),
})

export const updateSpaceSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().optional(),
    icon: z.string().trim().min(1).max(32).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  })

export const reorderSpacesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      position: z.number().int().min(0),
    })
  ).min(1),
})

export const transferSpaceSchema = z.object({
  targetVaultId: z.string().uuid(),
})
