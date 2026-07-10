import { getCloudflareContext } from "@opennextjs/cloudflare"
import { toNextJsHandler } from "better-auth/next-js"

import { createAuth } from "@nexus-vault/auth/server"

export const runtime = "edge"

const handler = async (request: Request) => {
  const cloudflare = await getCloudflareContext({ async: true })
  return createAuth(cloudflare.env, cloudflare.ctx).handler(request)
}

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(handler)
