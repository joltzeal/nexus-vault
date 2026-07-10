import { Hono } from "hono"

import { requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import {
  reviewResourceSubmissionSchema,
  submissionStatusSchema,
} from "@/server/schemas/submission"
import { enqueueMetadataTask } from "@/server/services/metadata-service"
import {
  approveResourceSubmission,
  listResourceSubmissions,
  rejectResourceSubmission,
} from "@/server/services/submission-service"

export const submissionRoutes = new Hono<ApiEnv>()

submissionRoutes.get("/vaults/:vaultId/submissions", async (c) => {
  const statusValue = c.req.query("status")
  const parsedStatus = statusValue ? submissionStatusSchema.safeParse(statusValue) : null
  const rows = await listResourceSubmissions(c.get("db"), c.req.param("vaultId"), {
    status: parsedStatus?.success ? parsedStatus.data : undefined,
    actor: requireActor(c),
  })

  return ok(c, { items: rows })
})

submissionRoutes.post("/vaults/:vaultId/submissions/:submissionId/approve", async (c) => {
  const input = await parseJson(c, reviewResourceSubmissionSchema)
  const result = await approveResourceSubmission(
    c.get("db"),
    c.req.param("vaultId"),
    c.req.param("submissionId"),
    {
      ...input,
      actor: requireActor(c),
    }
  )
  enqueueMetadataTask(c, result.metadataTask)

  return ok(c, result)
})

submissionRoutes.post("/vaults/:vaultId/submissions/:submissionId/reject", async (c) => {
  const input = await parseJson(c, reviewResourceSubmissionSchema)
  const result = await rejectResourceSubmission(
    c.get("db"),
    c.req.param("vaultId"),
    c.req.param("submissionId"),
    {
      note: input.note,
      actor: requireActor(c),
    }
  )

  return ok(c, result)
})
