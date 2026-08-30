import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../../lib/http"
import { reviewResourceSubmissionSchema } from "../../../../../../../schemas/submission"
import { enqueueMetadataTask } from "../../../../../../../services/metadata-service"
import { approveResourceSubmission } from "../../../../../../../services/submission-service"

type Context = { params: Promise<{ vaultId: string; submissionId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId, submissionId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, reviewResourceSubmissionSchema)
    const result = await approveResourceSubmission(context.db, vaultId, submissionId, {
      ...input,
      actor: requireActor(context.actor),
    })
    enqueueMetadataTask(context, result.metadataTask)
    return ok(result)
  })
}
