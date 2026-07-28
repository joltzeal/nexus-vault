import { getCloudflareContext } from "@opennextjs/cloudflare"

import { resolveAuthSessionFromRequest } from "@/auth/session"

export const dynamic = "force-dynamic"

async function handler(request: Request) {
  const env = await getRuntimeEnv()
  const session = await resolveAuthSessionFromRequest(request, env as Partial<CloudflareEnv>)

  const response = Response.json(session, {
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  })

  return response
}

async function getRuntimeEnv() {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return env
  } catch {
    return process.env
  }
}

export { handler as GET, handler as POST }
