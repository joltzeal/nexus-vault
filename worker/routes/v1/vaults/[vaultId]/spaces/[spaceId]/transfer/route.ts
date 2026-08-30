import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../../lib/http"
import { transferSpaceSchema } from "../../../../../../../schemas/space"
import { transferSpace } from "../../../../../../../services/space-service"

type Context = { params: Promise<{ vaultId: string; spaceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId, spaceId } = await params

  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, transferSpaceSchema)
    return ok(
      await transferSpace(db, vaultId, spaceId, {
        ...input,
        actor: requireActor(actor),
      }),
    )
  })
}
