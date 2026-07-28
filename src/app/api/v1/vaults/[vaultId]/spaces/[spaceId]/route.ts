import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateSpaceSchema } from "@/server/schemas/space"
import { archiveSpace, updateSpace } from "@/server/services/space-service"

type Context = { params: Promise<{ vaultId: string; spaceId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId, spaceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, updateSpaceSchema)
    return ok(
      await updateSpace(db, vaultId, spaceId, {
        ...input,
        actor: requireActor(actor),
      }),
    )
  })
}

export async function DELETE(request: Request, { params }: Context) {
  const { vaultId, spaceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await archiveSpace(db, vaultId, spaceId, { actor: requireActor(actor) })),
  )
}
