import { z } from "zod"

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().default(""),
  icon: z.string().trim().min(1).max(32).optional().default("tv"),
})

export const updateSpaceSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    icon: z.string().trim().min(1).max(32).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required.",
  })
