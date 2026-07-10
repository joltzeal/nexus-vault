import { getCloudflareContext } from "@opennextjs/cloudflare"

import { createApiApp } from "@/server/api/app"

export const runtime = "edge"

const app = createApiApp()

async function handle(request: Request) {
  const cloudflare = await getCloudflareContext({ async: true })
  return app.fetch(request, cloudflare.env, cloudflare.ctx)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
