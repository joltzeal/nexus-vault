import { api, queue } from "@/worker/api"
import type { QueueMessage } from "@/server/queues/messages"
import { runScheduledCloudDriveChecks } from "@/server/services/cloud-drive-check-service"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx)
    }

    if (!env.ASSETS) return new Response("Assets binding is not configured.", { status: 500 })

    if (isSpaNavigation(request) && !hasFileExtension(url.pathname)) {
      return fetchIndexAsset(request, env.ASSETS)
    }

    return env.ASSETS.fetch(request)
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runScheduledCloudDriveChecks(env, {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
    )
  },
  queue,
} satisfies ExportedHandler<CloudflareEnv, QueueMessage>

function isSpaNavigation(request: Request) {
  if (request.method !== "GET") return false
  const accept = request.headers.get("accept") ?? ""
  return accept.includes("text/html")
}

function hasFileExtension(pathname: string) {
  return /\/[^/]+\.[^/]+$/.test(pathname)
}

function fetchIndexAsset(request: Request, assets: Fetcher) {
  const indexUrl = new URL("/index.html", request.url)
  return assets.fetch(
    new Request(indexUrl, {
      headers: request.headers,
      method: "GET",
    }),
  )
}
