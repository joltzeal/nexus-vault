type TurnstileVerificationResponse = {
  success: boolean
  "error-codes"?: string[]
}

export async function verifyTurnstileToken(
  env: CloudflareEnv,
  input: {
    token: string
    remoteIp?: string
  }
) {
  const secret = (env as CloudflareEnv & { TURNSTILE_SECRET_KEY?: string })
    .TURNSTILE_SECRET_KEY

  if (!secret) {
    return {
      success: false,
      errorCodes: ["missing-secret"],
    }
  }

  const formData = new FormData()
  formData.set("secret", secret)
  formData.set("response", input.token)
  if (input.remoteIp) formData.set("remoteip", input.remoteIp)

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  )
  const payload = (await response.json()) as TurnstileVerificationResponse

  return {
    success: payload.success,
    errorCodes: payload["error-codes"] ?? [],
  }
}
