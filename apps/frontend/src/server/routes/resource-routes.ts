import { Hono } from "hono"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { requireActor } from "@/server/api/actor"
import {
  createResourceSchema,
  createResourceWithVaultSchema,
  reorderResourcesSchema,
  transferResourceSchema,
  updateResourceSchema,
} from "@/server/schemas/resource"
import {
  archiveResource,
  createResource,
  listResourceTransferTargets,
  reorderResources,
  transferResource,
  updateResource,
} from "@/server/services/resource-service"
import { enqueueMetadataTask } from "@/server/services/metadata-service"

export const resourceRoutes = new Hono<ApiEnv>()

resourceRoutes.get("/resources/transfer-targets", async (c) => {
  const result = await listResourceTransferTargets(c.get("db"), {
    actor: requireActor(c),
  })
  return ok(c, result)
})

resourceRoutes.post("/resources", async (c) => {
  const input = await parseJson(c, createResourceWithVaultSchema)
  const result = await createResource(c.get("db"), input.vaultId, {
    ...input,
    actor: requireActor(c),
  })
  enqueueMetadataTask(c, result.metadataTask)
  return ok(c, result, 201)
})

resourceRoutes.post("/vaults/:vaultId/resources", async (c) => {
  const input = await parseJson(c, createResourceSchema)
  const result = await createResource(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  enqueueMetadataTask(c, result.metadataTask)
  return ok(c, result, 201)
})

resourceRoutes.patch("/vaults/:vaultId/resources/reorder", async (c) => {
  const input = await parseJson(c, reorderResourcesSchema)
  const result = await reorderResources(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

resourceRoutes.patch("/resources/:resourceId", async (c) => {
  const input = await parseJson(c, updateResourceSchema)
  const result = await updateResource(c.get("db"), c.req.param("resourceId"), {
    ...input,
    actor: requireActor(c),
  })
  if (result.metadataTask) enqueueMetadataTask(c, result.metadataTask)
  return ok(c, result)
})

resourceRoutes.post("/resources/:resourceId/transfer", async (c) => {
  const input = await parseJson(c, transferResourceSchema)
  const result = await transferResource(c.get("db"), c.req.param("resourceId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

resourceRoutes.delete("/resources/:resourceId", async (c) => {
  const result = await archiveResource(c.get("db"), c.req.param("resourceId"), {
    actor: requireActor(c),
  })
  return ok(c, result)
})
