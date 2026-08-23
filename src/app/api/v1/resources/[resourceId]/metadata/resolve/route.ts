import { handleApiRequest, ok, requireActor } from "@/server/http"
import { resolveResourceMetadata } from "@/server/services/metadata-service"

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
