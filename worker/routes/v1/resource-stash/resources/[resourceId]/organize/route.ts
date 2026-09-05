import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../lib/http"
import { z } from "zod"
import { organizeStashResource } from "../../../../../../services/resource-stash-service"

const organizeSchema = z.object({
  targetVaultId: z.string().trim().min(1),
  targetSpaceId: z.string().trim().min(1),
})

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, organizeSchema)
    return ok(await organizeStashResource(db, resourceId, { ...input, actor: requireActor(actor) }))
  })
}
