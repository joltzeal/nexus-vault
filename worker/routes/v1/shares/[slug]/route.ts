import { getCookie, handleApiRequest, ok } from "../../../../lib/http"
import { getShareUnlockCookieName, getUnlockedSharedVaultDetail } from "../../../../services/share-service"

type Context = { params: Promise<{ slug: string }> }

export async function GET(request: Request, { params }: Context) {
  const { slug } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ db, env }) => {
    const url = new URL(request.url)
    const secret = url.searchParams.get("secret") || undefined
    const unlockToken = getCookie(request, getShareUnlockCookieName(slug))
    const result = await getUnlockedSharedVaultDetail(db, env, slug, unlockToken || undefined, { secret })
    if (!result || result.unavailable) return ok({ status: "unavailable" as const })
    if (result.passwordRequired) return ok({ status: "password" as const })
    return ok({ status: "ready" as const, detail: { ...result.detail, actorRole: "anonymous" as const } })
  })
}
