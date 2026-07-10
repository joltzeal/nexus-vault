import { z } from "zod"

import { resourceTypeSchema } from "@/server/schemas/resource"

export const submissionStatusSchema = z.enum(["pending", "approved", "rejected"])

export const createResourceSubmissionSchema = z.object({
  spaceId: z.string().trim().min(1).optional(),
  type: resourceTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().default(""),
  url: z.string().trim().min(1).max(4096),
  turnstileToken: z.string().trim().min(1),
})

export const reviewResourceSubmissionSchema = z.object({
  spaceId: z.string().trim().min(1).optional(),
  note: z.string().trim().max(1000).optional().default(""),
})
