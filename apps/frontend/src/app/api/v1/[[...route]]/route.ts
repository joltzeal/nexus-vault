import { getCloudflareContext } from "@opennextjs/cloudflare"

async function handle(request: Request) {
  try {
    const cloudflare = await getCloudflareContext({ async: true })
    const { createApiApp } = await import("@/server/api/app")
    const app = createApiApp()
    return app.fetch(request, cloudflare.env, cloudflare.ctx)
  } catch (error) {
    console.error("API route failed", error)
    return new Response(
      "API route failed",
      { status: 500 }
    )
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
