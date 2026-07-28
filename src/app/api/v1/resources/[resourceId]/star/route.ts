import { handleApiRequest, ok, requireActor } from "@/server/http"
import { starResource, unstarResource } from "@/server/services/star-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await starResource(db, resourceId, { actor: requireActor(actor) })),
  )
}

export async function DELETE(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await unstarResource(db, resourceId, { actor: requireActor(actor) })),
  )
}
