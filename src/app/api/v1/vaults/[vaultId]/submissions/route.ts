import { handleApiRequest, ok, requireActor } from "@/server/http"
import { submissionStatusSchema } from "@/server/schemas/submission"
import { listResourceSubmissions } from "@/server/services/submission-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db, url }) => {
    const statusValue = url.searchParams.get("status")
    const parsedStatus = statusValue ? submissionStatusSchema.safeParse(statusValue) : null
    const items = await listResourceSubmissions(db, vaultId, {
      status: parsedStatus?.success ? parsedStatus.data : undefined,
      actor: requireActor(actor),
    })
    return ok({ items })
  })
}
