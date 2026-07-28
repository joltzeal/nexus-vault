import { forbidden } from "@/server/api/errors"
import { handleApiRequest, ok, parseJson, serializeCookie } from "@/server/http"
import { unlockShareSchema } from "@/server/schemas/vault"
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
    const share = await unlockSharedVaultBySlug(db, env, slug, input)
    const unlocked = await getUnlockedSharedVaultDetail(
      db,
      env,
      slug,
      share.unlockToken ?? undefined,
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

    return ok(unlocked.detail, 200, headers)
  })
}
