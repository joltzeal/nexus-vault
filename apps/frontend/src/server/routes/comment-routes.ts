import { Hono } from "hono"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { getActor, requireActor } from "@/server/api/actor"
import { createCommentSchema } from "@/server/schemas/comment"
import {
  createComment,
  deleteComment,
  listComments,
} from "@/server/services/comment-service"
import { enqueueNotificationTask } from "@/server/services/notification-service"

export const commentRoutes = new Hono<ApiEnv>()

commentRoutes.get("/vaults/:vaultId/resources/:resourceId/comments", async (c) => {
  const rows = await listComments(c.get("db"), c.req.param("vaultId"), {
    resourceId: c.req.param("resourceId"),
    actor: getActor(c),
  })
  return ok(c, { items: rows })
})

commentRoutes.post("/vaults/:vaultId/resources/:resourceId/comments", async (c) => {
  const input = await parseJson(c, createCommentSchema)
  const result = await createComment(c.get("db"), c.req.param("vaultId"), {
    ...input,
    resourceId: c.req.param("resourceId"),
    actor: requireActor(c),
  })
  for (const task of result.notificationTasks) {
    enqueueNotificationTask(c, task)
  }
  return ok(c, result, 201)
})

commentRoutes.delete(
  "/vaults/:vaultId/resources/:resourceId/comments/:commentId",
  async (c) => {
  const result = await deleteComment(
    c.get("db"),
    c.req.param("vaultId"),
    c.req.param("resourceId"),
    c.req.param("commentId"),
    {
      actor: requireActor(c),
    }
  )
  return ok(c, result)
  }
)
