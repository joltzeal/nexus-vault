import { handleApiRequest, ok, requireActor } from "../../../../../../lib/http"
import { removeCollaborator } from "../../../../../../services/collaborator-service"

type Context = { params: Promise<{ vaultId: string; collaboratorId: string }> }

export async function DELETE(request: Request, { params }: Context) {
  const { vaultId, collaboratorId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(
      await removeCollaborator(db, vaultId, collaboratorId, {
        actor: requireActor(actor),
      }),
    ),
  )
}
