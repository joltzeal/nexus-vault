import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateResourceAnnotationSchema } from "@/server/schemas/resource"
import { clearResourceAnnotation, updateResourceAnnotation } from "@/server/services/resource-interaction-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, updateResourceAnnotationSchema)
    return ok(
      await updateResourceAnnotation(db, resourceId, {
        ...input,
        actor: requireActor(actor),
      }),
    )
  })
}

export async function DELETE(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await clearResourceAnnotation(db, resourceId, { actor: requireActor(actor) })),
  )
}
