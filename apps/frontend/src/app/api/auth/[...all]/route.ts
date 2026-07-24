import { getCloudflareContext } from "@opennextjs/cloudflare"
import { toNextJsHandler } from "better-auth/next-js"

import { createAuth } from "@nexus-vault/auth/server"
import { createDbSession } from "@nexus-vault/db"

const handler = async (request: Request) => {
  try {
    const cloudflare = await getCloudflareContext({ async: true })
    const session = await createDbSession(cloudflare.env)

    try {
      return await createAuth(cloudflare.env, session.db, cloudflare.ctx).handler(request)
    } finally {
      await session.close()
    }
  } catch (error) {
    console.error("Auth route failed", error)
    return Response.json(
      {
        success: false,
        data: null,
        error: {
          code: "AUTH_ROUTE_FAILED",
          message: "认证失败，请稍后再试。",
        },
      },
      { status: 500 }
    )
  }
}

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(handler)
