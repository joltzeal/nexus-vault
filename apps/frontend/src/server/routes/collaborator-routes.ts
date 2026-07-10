import { Hono } from "hono"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { requireActor } from "@/server/api/actor"
import { upsertCollaboratorSchema } from "@/server/schemas/collaborator"
import {
  listCollaborators,
  upsertCollaborator,
} from "@/server/services/collaborator-service"
import { enqueueNotificationTask } from "@/server/services/notification-service"

export const collaboratorRoutes = new Hono<ApiEnv>()

collaboratorRoutes.get("/vaults/:vaultId/collaborators", async (c) => {
  const rows = await listCollaborators(c.get("db"), c.req.param("vaultId"), {
    actor: requireActor(c),
  })
  return ok(c, { items: rows })
})

collaboratorRoutes.post("/vaults/:vaultId/collaborators", async (c) => {
  const input = await parseJson(c, upsertCollaboratorSchema)
  const result = await upsertCollaborator(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  enqueueNotificationTask(c, {
    kind: "notification.create",
    userId: result.userId,
    vaultId: c.req.param("vaultId"),
    type: "collaborator.upserted",
    title: "你已被添加到资源集",
    body: `角色：${input.role}`,
    requestedAt: new Date().toISOString(),
  })
  return ok(c, result, 201)
})
