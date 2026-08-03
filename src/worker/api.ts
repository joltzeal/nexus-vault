import { Hono } from "hono"

import { createAuthSession } from "@/auth"
import { getRegistrationMode } from "@/auth/registration"
import { resolveViewerFromRequest } from "@/auth/session"
import { createDbSession } from "@/db"
import type { VaultWorkspaceInitialData } from "@/features/types"
import { loadDashboardWorkspace } from "@/features/dashboard-loader"
import { mapVaultDetail } from "@/features/mappers"
import { withApiRuntime } from "@/server/http"
import { consumeQueueBatch } from "@/server/queues/worker-consumer"
import {
  getShareUnlockCookieName,
  getUnlockedSharedVaultDetail,
} from "@/server/services/share-service"
import type { QueueMessage } from "@/server/queues/messages"
import { getTurnstileSiteKey } from "@/server/services/turnstile-service"

import * as healthRoute from "@/app/api/v1/health/route"
import * as accountIntegrationsRoute from "@/app/api/v1/account/integrations/route"
import * as accountXComIntegrationRoute from "@/app/api/v1/account/integrations/x-com/route"
import * as notificationsRoute from "@/app/api/v1/notifications/route"
import * as notificationReadRoute from "@/app/api/v1/notifications/[notificationId]/read/route"
import * as notificationSummaryRoute from "@/app/api/v1/notifications/summary/route"
import * as resourceReadLaterRoute from "@/app/api/v1/resource-read-later/route"
import * as resourceStarsRoute from "@/app/api/v1/resource-stars/route"
import * as resourcesRoute from "@/app/api/v1/resources/route"
import * as resourceRoute from "@/app/api/v1/resources/[resourceId]/route"
import * as resourceAnnotationRoute from "@/app/api/v1/resources/[resourceId]/annotation/route"
import * as resourceMetadataResolveRoute from "@/app/api/v1/resources/[resourceId]/metadata/resolve/route"
import * as resourceReadLaterToggleRoute from "@/app/api/v1/resources/[resourceId]/read-later/route"
import * as resourceStarRoute from "@/app/api/v1/resources/[resourceId]/star/route"
import * as resourceTransferRoute from "@/app/api/v1/resources/[resourceId]/transfer/route"
import * as resourcesTransferRoute from "@/app/api/v1/resources/transfer/route"
import * as resourceTransferTargetsRoute from "@/app/api/v1/resources/transfer-targets/route"
import * as shareSubmissionsRoute from "@/app/api/v1/shares/[slug]/submissions/route"
import * as shareUnlockRoute from "@/app/api/v1/shares/[slug]/unlock/route"
import * as starsRoute from "@/app/api/v1/stars/route"
import * as vaultsRoute from "@/app/api/v1/vaults/route"
import * as vaultRoute from "@/app/api/v1/vaults/[vaultId]/route"
import * as vaultAlertsRoute from "@/app/api/v1/vaults/[vaultId]/alerts/route"
import * as vaultAlertsReadRoute from "@/app/api/v1/vaults/[vaultId]/alerts/read/route"
import * as vaultCollaboratorsRoute from "@/app/api/v1/vaults/[vaultId]/collaborators/route"
import * as vaultCollaboratorRoute from "@/app/api/v1/vaults/[vaultId]/collaborators/[collaboratorId]/route"
import * as vaultExportRoute from "@/app/api/v1/vaults/[vaultId]/export/route"
import * as vaultForkRoute from "@/app/api/v1/vaults/[vaultId]/fork/route"
import * as vaultResourcesRoute from "@/app/api/v1/vaults/[vaultId]/resources/route"
import * as vaultResourceMetadataStatusRoute from "@/app/api/v1/vaults/[vaultId]/resources/metadata-status/route"
import * as vaultResourcesReorderRoute from "@/app/api/v1/vaults/[vaultId]/resources/reorder/route"
import * as vaultShareRoute from "@/app/api/v1/vaults/[vaultId]/share/route"
import * as vaultSpacesRoute from "@/app/api/v1/vaults/[vaultId]/spaces/route"
import * as vaultSpaceRoute from "@/app/api/v1/vaults/[vaultId]/spaces/[spaceId]/route"
import * as vaultSpaceTransferRoute from "@/app/api/v1/vaults/[vaultId]/spaces/[spaceId]/transfer/route"
import * as vaultSpacesReorderRoute from "@/app/api/v1/vaults/[vaultId]/spaces/reorder/route"
import * as vaultStarRoute from "@/app/api/v1/vaults/[vaultId]/star/route"
import * as vaultSubmissionsRoute from "@/app/api/v1/vaults/[vaultId]/submissions/route"
import * as vaultSubmissionApproveRoute from "@/app/api/v1/vaults/[vaultId]/submissions/[submissionId]/approve/route"
import * as vaultSubmissionRejectRoute from "@/app/api/v1/vaults/[vaultId]/submissions/[submissionId]/reject/route"
import * as vaultImportRoute from "@/app/api/v1/vaults/import/route"

type HonoEnv = {
  Bindings: CloudflareEnv
}

type NextRouteModule = Partial<
  Record<
    "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
    (request: Request, context: never) => Response | Promise<Response>
  >
>

export const api = new Hono<HonoEnv>()

api.all("/api/auth/*", async (c) => {
  const session = await createAuthSession(c.env as never)
  try {
    return await session.auth.handler(c.req.raw)
  } finally {
    await session.close()
  }
})

api.get("/api/bootstrap", async (c) => {
  const registrationMode = await getRegistrationMode(c.env)
  const viewer = await resolveViewerFromRequest(c.req.raw, c.env)
  let initialData: VaultWorkspaceInitialData | null = null

  if (viewer) {
    initialData = await loadDashboardWorkspace(viewer, c.env)
    initialData.turnstileSiteKey = getTurnstileSiteKey(c.env)
  }

  return c.json({
    success: true,
    data: {
      registrationMode,
      viewer,
      initialData,
      turnstileSiteKey: getTurnstileSiteKey(c.env),
    },
    error: null,
  })
})

api.get("/api/bootstrap/share/:slug", async (c) => {
  const slug = c.req.param("slug")
  const database = await createDbSession(c.env)
  try {
    const viewer = await resolveViewerFromRequest(c.req.raw, c.env, database.db)
    const share = await getUnlockedSharedVaultDetail(
      database.db,
      c.env,
      slug,
      getShareUnlockToken(c.req.raw, slug),
      { actor: viewer ?? undefined },
    )
    const initialData = share?.detail
      ? mapVaultDetail({
          ...share.detail,
          actorRole: share.actorRole,
        })
      : null

    return c.json({
      success: true,
      data: {
        share: share
          ? {
              unavailable: share.unavailable,
              passwordRequired: share.passwordRequired,
              initialData: initialData
                ? {
                    sets: [initialData],
                    activeSetId: initialData.id,
                    ...(viewer
                      ? {
                          actorId: viewer.id,
                          actorEmail: viewer.email,
                          actorName: viewer.name,
                        }
                      : {}),
                    mode: "share",
                    shareSlug: slug,
                    turnstileSiteKey: getTurnstileSiteKey(c.env),
                  }
                : null,
            }
          : null,
        turnstileSiteKey: getTurnstileSiteKey(c.env),
      },
      error: null,
    })
  } finally {
    await database.close()
  }
})

api.get("/api/v1/media/*", async (c) => {
  const objectKey = c.req.path
    .slice("/api/v1/media/".length)
    .split("/")
    .map(decodeURIComponent)
    .join("/")

  if (!isPublicMediaObjectKey(objectKey)) {
    return new Response("Media not found.", { status: 404 })
  }

  const object = await c.env.MEDIA.get(objectKey)
  if (!object) return new Response("Media not found.", { status: 404 })

  const headers = new Headers({
    "cache-control": object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  })
  const metadata = object.httpMetadata

  if (metadata?.contentType) headers.set("content-type", metadata.contentType)
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage)
  if (metadata?.contentDisposition) headers.set("content-disposition", metadata.contentDisposition)
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding)
  if (metadata?.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString())

  return new Response(object.body, { headers })
})

function isPublicMediaObjectKey(objectKey: string) {
  return objectKey.startsWith("screenshots/") || objectKey.startsWith("telegram/")
}

register("/api/v1/health", healthRoute)
register("/api/v1/account/integrations", accountIntegrationsRoute)
register("/api/v1/account/integrations/x-com", accountXComIntegrationRoute)
register("/api/v1/notifications", notificationsRoute)
register("/api/v1/notifications/:notificationId/read", notificationReadRoute)
register("/api/v1/notifications/summary", notificationSummaryRoute)
register("/api/v1/resource-read-later", resourceReadLaterRoute)
register("/api/v1/resource-stars", resourceStarsRoute)
register("/api/v1/resources", resourcesRoute)
register("/api/v1/resources/transfer", resourcesTransferRoute)
register("/api/v1/resources/transfer-targets", resourceTransferTargetsRoute)
register("/api/v1/resources/:resourceId", resourceRoute)
register("/api/v1/resources/:resourceId/annotation", resourceAnnotationRoute)
register("/api/v1/resources/:resourceId/metadata/resolve", resourceMetadataResolveRoute)
register("/api/v1/resources/:resourceId/read-later", resourceReadLaterToggleRoute)
register("/api/v1/resources/:resourceId/star", resourceStarRoute)
register("/api/v1/resources/:resourceId/transfer", resourceTransferRoute)
register("/api/v1/shares/:slug/submissions", shareSubmissionsRoute)
register("/api/v1/shares/:slug/unlock", shareUnlockRoute)
register("/api/v1/stars", starsRoute)
register("/api/v1/vaults", vaultsRoute)
register("/api/v1/vaults/import", vaultImportRoute)
register("/api/v1/vaults/:vaultId", vaultRoute)
register("/api/v1/vaults/:vaultId/alerts", vaultAlertsRoute)
register("/api/v1/vaults/:vaultId/alerts/read", vaultAlertsReadRoute)
register("/api/v1/vaults/:vaultId/collaborators", vaultCollaboratorsRoute)
register("/api/v1/vaults/:vaultId/collaborators/:collaboratorId", vaultCollaboratorRoute)
register("/api/v1/vaults/:vaultId/export", vaultExportRoute)
register("/api/v1/vaults/:vaultId/fork", vaultForkRoute)
register("/api/v1/vaults/:vaultId/resources", vaultResourcesRoute)
register("/api/v1/vaults/:vaultId/resources/metadata-status", vaultResourceMetadataStatusRoute)
register("/api/v1/vaults/:vaultId/resources/reorder", vaultResourcesReorderRoute)
register("/api/v1/vaults/:vaultId/share", vaultShareRoute)
register("/api/v1/vaults/:vaultId/spaces", vaultSpacesRoute)
register("/api/v1/vaults/:vaultId/spaces/reorder", vaultSpacesReorderRoute)
register("/api/v1/vaults/:vaultId/spaces/:spaceId", vaultSpaceRoute)
register("/api/v1/vaults/:vaultId/spaces/:spaceId/transfer", vaultSpaceTransferRoute)
register("/api/v1/vaults/:vaultId/star", vaultStarRoute)
register("/api/v1/vaults/:vaultId/submissions", vaultSubmissionsRoute)
register("/api/v1/vaults/:vaultId/submissions/:submissionId/approve", vaultSubmissionApproveRoute)
register("/api/v1/vaults/:vaultId/submissions/:submissionId/reject", vaultSubmissionRejectRoute)

api.notFound((c) =>
  c.json(
    {
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: "API endpoint not found." },
    },
    404,
  ),
)

export function queue(batch: MessageBatch<QueueMessage>, env: CloudflareEnv) {
  return consumeQueueBatch(batch, env)
}

function register(path: string, route: unknown) {
  const routeModule = route as NextRouteModule
  for (const method of ["DELETE", "GET", "PATCH", "POST", "PUT"] as const) {
    const handler = routeModule[method]
    if (!handler) continue

    api.on(method, path, (c) => {
      const runtime = {
        env: c.env,
        executionCtx: {
          waitUntil(promise: Promise<unknown>) {
            c.executionCtx.waitUntil(promise)
          },
        },
      }
      return withApiRuntime(runtime, () =>
        handler(c.req.raw, { params: Promise.resolve(c.req.param()) } as never),
      )
    })
  }
}

function getShareUnlockToken(request: Request, slug: string) {
  const cookieName = getShareUnlockCookieName(slug)
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined

  const prefix = `${cookieName}=`
  const value = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)

  return value ? decodeURIComponent(value) : undefined
}
