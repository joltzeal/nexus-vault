import { handleApiRequest, ok, requireActor } from "@/server/http"
import { addResourceReadLater, removeResourceReadLater } from "@/server/services/resource-interaction-service"

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
