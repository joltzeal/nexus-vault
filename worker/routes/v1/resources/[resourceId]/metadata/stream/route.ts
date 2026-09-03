import { handleApiRequest } from "../../../../../../lib/http"
import { createResourceAiSummaryStream } from "../../../../../../services/resource-ai-summary-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, env }) =>
    createResourceAiSummaryStream(db, env, resourceId, actor, request.signal),
  )
}
