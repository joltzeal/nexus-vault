export type TurnstileEnv = Partial<CloudflareEnv> & {
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_ALLOWED_HOSTNAMES?: string
}

type TurnstileVerificationResponse = {
  success: boolean
  action?: string
  hostname?: string
  "error-codes"?: string[]
}

export function getTurnstileSiteKey(env: TurnstileEnv) {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim()
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim()

  return siteKey && secretKey ? siteKey : undefined
}

export function isTurnstileEnabled(env: TurnstileEnv) {
  return Boolean(getTurnstileSiteKey(env))
}

export function getTurnstileAllowedHostnames(env: TurnstileEnv) {
  return (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
}

export async function verifyTurnstileToken(
  env: TurnstileEnv,
  input: {
    token: string
    remoteIp?: string
    action?: string
  }
) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    return {
      success: false,
      errorCodes: ["missing-secret"],
    }
  }
  if (!input.token.trim()) {
    return {
      success: false,
      errorCodes: ["missing-response"],
    }
  }

  const formData = new FormData()
  formData.set("secret", secret)
  formData.set("response", input.token)
  if (input.remoteIp) formData.set("remoteip", input.remoteIp)

  let payload: TurnstileVerificationResponse

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(8_000),
      }
    )

    if (!response.ok) {
      return { success: false, errorCodes: [`http-${response.status}`] }
    }

    payload = (await response.json()) as TurnstileVerificationResponse
  } catch {
    return { success: false, errorCodes: ["verification-unavailable"] }
  }

  const allowedHostnames = getTurnstileAllowedHostnames(env)
  const hostname = payload.hostname?.trim().toLowerCase()

  return {
    success:
      payload.success &&
      (!input.action || payload.action === input.action) &&
      (allowedHostnames.length === 0 || (hostname ? allowedHostnames.includes(hostname) : false)),
    errorCodes: payload["error-codes"] ?? [],
  }
}
