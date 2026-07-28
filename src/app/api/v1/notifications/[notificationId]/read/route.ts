import { handleApiRequest, ok, requireActor } from "@/server/http"
import { markNotificationRead } from "@/server/services/notification-service"

type Context = { params: Promise<{ notificationId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { notificationId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await markNotificationRead(db, notificationId, { actor: requireActor(actor) })),
  )
}
