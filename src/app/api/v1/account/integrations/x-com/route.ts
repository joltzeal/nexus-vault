import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateXComCookieSchema } from "@/server/schemas/account-integrations"
import { updateUserXComCookie } from "@/server/services/account-integration-service"

export async function PUT(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, updateXComCookieSchema)
    return ok(
      await updateUserXComCookie(db, {
        cookieString: input.cookieString,
        userId: requireActor(actor).id,
      }),
    )
  })
}
