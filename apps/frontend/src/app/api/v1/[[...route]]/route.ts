import { getCloudflareContext } from "@opennextjs/cloudflare"

import { createApiApp } from "@/server/api/app"

const app = createApiApp()

async function handle(request: Request) {
  try {
    const cloudflare = await getCloudflareContext({ async: true })
    return app.fetch(request, cloudflare.env, cloudflare.ctx)
  } catch (error) {
    console.error("API route failed", error)
    return Response.json(
      {
        success: false,
        data: null,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "API 请求失败，请稍后再试。",
        },
      },
      { status: 500 }
    )
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
