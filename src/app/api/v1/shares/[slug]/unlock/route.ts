import { forbidden } from "@/server/api/errors"
import { resolveViewerFromRequest } from "@/auth/session"
import { handleApiRequest, ok, parseJson, serializeCookie } from "@/server/http"
import { unlockShareSchema } from "@/server/schemas/vault"
import {
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/server/services/turnstile-service"
import {
  getShareUnlockCookieName,
  getShareUnlockCookieOptions,
  getUnlockedSharedVaultDetail,
  unlockSharedVaultBySlug,
} from "@/server/services/share-service"

type Context = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Context) {
  const { slug } = await params
  return handleApiRequest(request, { auth: "none" }, async ({ db, env, url }) => {
    const input = await parseJson(request, unlockShareSchema)
    if (isTurnstileEnabled(env)) {
      const turnstile = await verifyTurnstileToken(env, {
        action: "share_unlock",
        token: input.turnstileToken ?? "",
        remoteIp: request.headers.get("CF-Connecting-IP") ?? undefined,
      })
      if (!turnstile.success) throw forbidden("请完成人机验证后再解锁。")
    }
    const share = await unlockSharedVaultBySlug(db, env, slug, input)
    const viewer = await resolveViewerFromRequest(request, env, db)
    const unlocked = await getUnlockedSharedVaultDetail(
      db,
      env,
      slug,
      share.unlockToken ?? undefined,
      { actor: viewer ?? undefined },
    )

    if (!unlocked || unlocked.passwordRequired || !unlocked.detail) {
      throw forbidden("Share unlock failed.")
    }

    const headers = share.unlockToken
      ? {
          "set-cookie": serializeCookie(
            getShareUnlockCookieName(slug),
            share.unlockToken,
            getShareUnlockCookieOptions(slug, share.maxAge, {
              secure: url.protocol === "https:",
            }),
          ),
        }
      : undefined

    return ok(
      {
        ...unlocked.detail,
        actorRole: unlocked.actorRole,
        ...(viewer
          ? {
              actorId: viewer.id,
              actorEmail: viewer.email,
              actorName: viewer.name,
            }
          : {}),
      },
      200,
      headers,
    )
  })
}
