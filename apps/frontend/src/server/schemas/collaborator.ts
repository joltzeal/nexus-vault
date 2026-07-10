import { z } from "zod"

export const roleSchema = z.enum(["owner", "admin", "editor", "viewer"])

export const upsertCollaboratorSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
  role: roleSchema,
})
