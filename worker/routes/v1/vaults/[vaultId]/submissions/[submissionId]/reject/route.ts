import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../../lib/http"
import { reviewResourceSubmissionSchema } from "../../../../../../../schemas/submission"
import { rejectResourceSubmission } from "../../../../../../../services/submission-service"

type Context = { params: Promise<{ vaultId: string; submissionId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId, submissionId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, reviewResourceSubmissionSchema)
    return ok(
      await rejectResourceSubmission(db, vaultId, submissionId, {
        note: input.note,
        actor: requireActor(actor),
      }),
    )
  })
}
