import { Hono } from "hono"

import { ApiError } from "@/server/api/errors"
import { actorMiddleware, dbMiddleware } from "@/server/api/middleware"
import { fail, failUnknown } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { collaboratorRoutes } from "@/server/routes/collaborator-routes"
import { commentRoutes } from "@/server/routes/comment-routes"
import { forkRoutes } from "@/server/routes/fork-routes"
import { healthRoutes } from "@/server/routes/health-routes"
import { metadataRoutes } from "@/server/routes/metadata-routes"
import { notificationRoutes } from "@/server/routes/notification-routes"
import { resourceRoutes } from "@/server/routes/resource-routes"
import { shareRoutes } from "@/server/routes/share-routes"
import { spaceRoutes } from "@/server/routes/space-routes"
import { starRoutes } from "@/server/routes/star-routes"
import { submissionRoutes } from "@/server/routes/submission-routes"
import { vaultRoutes } from "@/server/routes/vault-routes"

export function createApiApp() {
  const app = new Hono<ApiEnv>().basePath("/api/v1")

  app.use("*", dbMiddleware)
  app.use("*", actorMiddleware)

  app.onError((error, c) => {
    if (error instanceof ApiError) return fail(c, error)

    console.error(error)
    return failUnknown(c)
  })

  app.route("/", healthRoutes)
  app.route("/", vaultRoutes)
  app.route("/", spaceRoutes)
  app.route("/", resourceRoutes)
  app.route("/", collaboratorRoutes)
  app.route("/", shareRoutes)
  app.route("/", commentRoutes)
  app.route("/", starRoutes)
  app.route("/", forkRoutes)
  app.route("/", submissionRoutes)
  app.route("/", metadataRoutes)
  app.route("/", notificationRoutes)

  return app
}
