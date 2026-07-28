import { z } from "zod"

export const upsertCollaboratorSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
})
