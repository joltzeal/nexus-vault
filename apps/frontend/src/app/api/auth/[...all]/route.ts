import { getCloudflareContext } from "@opennextjs/cloudflare"
import { toNextJsHandler } from "better-auth/next-js"

const handler = async (request: Request) => {
  try {
    const cloudflare = await getCloudflareContext({ async: true })
    const { createAuth } = await import("@nexus-vault/auth/server")
    return createAuth(cloudflare.env, cloudflare.ctx).handler(request)
  } catch (error) {
    console.error("Auth route failed", error)
    return new Response(
      "Auth route failed",
      { status: 500 }
    )
  }
}

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(handler)
