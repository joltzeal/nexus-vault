import { Hono } from "hono"
import { getCookie, setCookie } from "hono/cookie"

import { forbidden } from "@/server/api/errors"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { getActor, requireActor } from "@/server/api/actor"
import { createResourceSubmissionSchema } from "@/server/schemas/submission"
import { unlockShareSchema, updateShareSchema } from "@/server/schemas/vault"
import {
  getShareUnlockCookieName,
  getShareUnlockCookieOptions,
  getShare,
  getUnlockedSharedVaultDetail,
  unlockSharedVaultBySlug,
  upsertShare,
} from "@/server/services/share-service"
import { createResourceSubmission } from "@/server/services/submission-service"
import { enqueueNotificationTask } from "@/server/services/notification-service"
import { verifyTurnstileToken } from "@/server/services/turnstile-service"

export const shareRoutes = new Hono<ApiEnv>()

shareRoutes.get("/vaults/:vaultId/share", async (c) => {
  const share = await getShare(c.get("db"), c.req.param("vaultId"), {
    actor: requireActor(c),
  })
  return ok(c, { share })
})

shareRoutes.put("/vaults/:vaultId/share", async (c) => {
  const input = await parseJson(c, updateShareSchema)
  const result = await upsertShare(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

shareRoutes.post("/shares/:slug/unlock", async (c) => {
  const slug = c.req.param("slug")
  const input = await parseJson(c, unlockShareSchema)
  const share = await unlockSharedVaultBySlug(c.get("db"), c.env, slug, input)
  if (share.unlockToken) {
    setCookie(c, getShareUnlockCookieName(slug), share.unlockToken, {
      ...getShareUnlockCookieOptions(slug, share.maxAge, {
        secure: new URL(c.req.url).protocol === "https:",
      }),
    })
  }

  const unlocked = await getUnlockedSharedVaultDetail(
    c.get("db"),
    c.env,
    slug,
    share.unlockToken ?? undefined
  )

  if (!unlocked || unlocked.passwordRequired || !unlocked.detail) {
    throw forbidden("Share unlock failed.")
  }

  return ok(c, unlocked.detail)
})

shareRoutes.post("/shares/:slug/submissions", async (c) => {
  const slug = c.req.param("slug")
  const unlockToken = getCookie(c, getShareUnlockCookieName(slug))
  const unlocked = await getUnlockedSharedVaultDetail(c.get("db"), c.env, slug, unlockToken)

  if (!unlocked || unlocked.unavailable || unlocked.passwordRequired || !unlocked.detail) {
    throw forbidden("Share is not available for submissions.")
  }
  if (!unlocked.detail.vault.collectionEnabled) {
    throw forbidden("This vault is not accepting submissions.")
  }

  const input = await parseJson(c, createResourceSubmissionSchema)
  const turnstile = await verifyTurnstileToken(c.env, {
    token: input.turnstileToken,
    remoteIp: c.req.header("CF-Connecting-IP"),
  })
  if (!turnstile.success) {
    throw forbidden("请完成人机验证后再提交。")
  }

  const result = await createResourceSubmission(c.get("db"), unlocked.detail.vault.id, {
    spaceId: input.spaceId,
    type: input.type,
    title: input.title,
    description: input.description,
    url: input.url,
    actor: getActor(c),
    env: c.env,
  })
  if (result.notificationTask) enqueueNotificationTask(c, result.notificationTask)

  return ok(c, { id: result.id, status: result.status }, 201)
})
