import { handleApiRequest, ok, requireActor } from "../../../../../lib/http"
import { addResourceReadLater, removeResourceReadLater } from "../../../../../services/resource-interaction-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await addResourceReadLater(db, resourceId, { actor: requireActor(actor) })),
  )
}

export async function DELETE(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await removeResourceReadLater(db, resourceId, { actor: requireActor(actor) })),
  )
}
