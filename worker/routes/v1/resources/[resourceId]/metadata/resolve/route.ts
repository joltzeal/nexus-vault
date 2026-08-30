import { handleApiRequest, ok, requireActor } from "../../../../../../lib/http"
import { resolveResourceMetadata } from "../../../../../../services/metadata-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db, env }) =>
    ok(await resolveResourceMetadata(db, resourceId, {
      actor: requireActor(actor),
      env,
    })),
  )
}
