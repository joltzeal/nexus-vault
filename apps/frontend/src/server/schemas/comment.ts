import { z } from "zod"

export const createCommentSchema = z.object({
  parentId: z.string().trim().min(1).optional(),
  authorName: z.string().trim().min(1).max(80).optional().default("Anonymous"),
  body: z.string().trim().min(1).max(4000),
})
