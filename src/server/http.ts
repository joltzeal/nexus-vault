import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { z } from "zod"

import { hasSessionCookie } from "@/auth/cookies"
import { resolveViewerFromRequest } from "@/auth/session"
import { createDbSession } from "@/db"
import { ApiError, unauthorized, validationFailed } from "@/server/api/errors"
import type { Actor, ApiContext, ApiBindings, Db } from "@/server/api/types"

type AuthMode = "none" | "optional" | "required"

export type RequestContext = ApiContext & {
  actor?: Actor
  db: Db
  request: Request
  url: URL
}

export async function handleApiRequest(
  request: Request,
  options: { auth?: AuthMode } = {},
  handler: (context: RequestContext) => Promise<Response> | Response,
) {
  let database: Awaited<ReturnType<typeof createDbSession>> | undefined

  try {
    const runtime = await getRuntimeContext()
    const authMode = options.auth ?? "required"
    if (authMode === "required" && !hasSessionCookie(request)) throw unauthorized()

    database = await createDbSession(runtime.env)
    const actor =
      authMode === "none"
        ? undefined
        : await resolveViewerFromRequest(request, runtime.env, database.db)

    if (authMode === "required" && !actor) throw unauthorized()

    return await handler({
      actor: actor ?? undefined,
      db: database.db,
      env: runtime.env,
      executionCtx: runtime.executionCtx,
      request,
      url: new URL(request.url),
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return failure(error)
    }

    console.error("API request failed", {
      method: request.method,
      path: new URL(request.url).pathname,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    })

    return failure(new ApiError("INTERNAL_SERVER_ERROR", "The API request failed.", 500))
  } finally {
    await database?.close().catch((error) => {
      console.error("Database session close failed", { error })
    })
  }
}

export function requireActor(actor: Actor | undefined) {
  if (!actor) throw unauthorized()
  return actor
}

export async function parseJson<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) throw validationFailed(parsed.error.flatten())
  return parsed.data
}

export function ok(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(
    { success: true, data, error: null },
    { status, headers },
  )
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.get("cookie")
  if (!header) return undefined

  const prefix = `${name}=`
  const value = header
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)

  return value ? decodeURIComponent(value) : undefined
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean
    maxAge?: number
    path?: string
    sameSite?: "Lax" | "Strict" | "None" | "lax" | "strict" | "none"
    secure?: boolean
  } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  parts.push(`Path=${options.path ?? "/"}`)
  if (options.httpOnly) parts.push("HttpOnly")
  if (options.secure) parts.push("Secure")
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)

  return parts.join("; ")
}

function failure(error: ApiError) {
  return Response.json(
    {
      success: false,
      data: null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    },
    { status: error.status },
  )
}

async function getRuntimeContext() {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true })
    return {
      env: env as unknown as ApiBindings,
      executionCtx: {
        waitUntil(promise: Promise<unknown>) {
          ctx.waitUntil(promise)
        },
      },
    }
  } catch {
    return {
      env: process.env as unknown as ApiBindings,
      executionCtx: {
        waitUntil(promise: Promise<unknown>) {
          void promise.catch((error) => console.error(error))
        },
      },
    }
  }
}
