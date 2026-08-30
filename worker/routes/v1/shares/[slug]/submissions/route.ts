import { forbidden } from "../../../../../lib/errors"
import { getCookie, handleApiRequest, ok, parseJson } from "../../../../../lib/http"
import { createResourceSubmissionSchema } from "../../../../../schemas/submission"
import { enqueueNotificationTask } from "../../../../../services/notification-service"
import { getShareUnlockCookieName, getUnlockedSharedVaultDetail } from "../../../../../services/share-service"
import { createResourceSubmission } from "../../../../../services/submission-service"
import {
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "../../../../../services/turnstile-service"

type Context = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Context) {
  const { slug } = await params
  return handleApiRequest(request, { auth: "optional" }, async (context) => {
    const unlockToken = getCookie(request, getShareUnlockCookieName(slug))
    const unlocked = await getUnlockedSharedVaultDetail(
      context.db,
      context.env,
      slug,
      unlockToken,
    )

    if (!unlocked || unlocked.unavailable || unlocked.passwordRequired || !unlocked.detail) {
      throw forbidden("Share is not available for submissions.")
    }
    if (!unlocked.detail.vault.collectionEnabled) {
      throw forbidden("This vault is not accepting submissions.")
    }

    const input = await parseJson(request, createResourceSubmissionSchema)
    if (isTurnstileEnabled(context.env)) {
      const turnstile = await verifyTurnstileToken(context.env, {
        action: "resource_submission",
        token: input.turnstileToken ?? "",
        remoteIp: request.headers.get("CF-Connecting-IP") ?? undefined,
      })
      if (!turnstile.success) throw forbidden("请完成人机验证后再提交。")
    }

    const result = await createResourceSubmission(
      context.db,
      unlocked.detail.vault.id,
      {
        spaceId: input.spaceId,
        type: input.type,
        title: input.title,
        description: input.description,
        url: input.url,
        actor: context.actor,
        env: context.env,
      },
    )
    if (result.notificationTask) enqueueNotificationTask(context, result.notificationTask)

    return ok({ id: result.id, status: result.status }, 201)
  })
}
