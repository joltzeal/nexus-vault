import { getCloudflareContext } from "@opennextjs/cloudflare"

import { handleAuthRequest } from "@/auth"

export const dynamic = "force-dynamic"

async function handler(request: Request) {
  const env = await getRuntimeEnv()
  return handleAuthRequest(request, env as never)
}

async function getRuntimeEnv() {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return env
  } catch {
    return process.env
  }
}

export { handler as POST }
