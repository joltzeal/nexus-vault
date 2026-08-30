import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { upsertCollaboratorSchema } from "../../../../../schemas/collaborator"
import { listCollaborators, upsertCollaborator } from "../../../../../services/collaborator-service"
import { enqueueNotificationTask } from "../../../../../services/notification-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listCollaborators(db, vaultId, { actor: requireActor(actor) }) }),
  )
}

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, upsertCollaboratorSchema)
    const result = await upsertCollaborator(context.db, vaultId, {
      ...input,
      actor: requireActor(context.actor),
    })
    enqueueNotificationTask(context, {
      kind: "notification.create",
      userId: result.userId,
      vaultId,
      type: "collaborator.upserted",
      title: "你已被添加为编辑者",
      body: "你现在可以为这个 vault 贡献资源。",
      requestedAt: new Date().toISOString(),
    })
    return ok(result, 201)
  })
}
