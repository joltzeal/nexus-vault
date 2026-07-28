import { z } from "zod"

import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { markVaultAlertsRead } from "@/server/services/alert-service"

const schema = z.object({
  notificationIds: z.array(z.string()).max(100).default([]),
})

type Context = { params: Promise<{ vaultId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, schema)
    return ok(
      await markVaultAlertsRead(db, vaultId, {
        actor: requireActor(actor),
        notificationIds: input.notificationIds,
      }),
    )
  })
}
