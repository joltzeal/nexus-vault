import { and, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"

import {
  createClearSessionHeaders,
  createSessionHeaders,
  getSessionToken,
} from "@/auth/cookies"
import { hashPassword, isBcryptHash, validatePassword, verifyPassword } from "@/auth/password"
import {
  canCreateUser,
  markUsersExist,
  type RegistrationEnv,
} from "@/auth/registration"
import { resolveAuthSessionFromRequest } from "@/auth/session"
import { createDbSession, type Db } from "@/db"
import { account, session, user } from "@/db/auth-schema"

type RuntimeEnv = Partial<CloudflareEnv> & RegistrationEnv

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
})

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(100),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
  revokeOtherSessions: z.boolean().optional(),
})

class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

export async function handleAuthRequest(request: Request, env: RuntimeEnv) {
  let database: Awaited<ReturnType<typeof createDbSession>> | undefined
  try {
    assertSameOrigin(request)
    database = await createDbSession(env)
    const path = new URL(request.url).pathname

    if (request.method === "POST" && path.endsWith("/sign-in/email")) {
      return await signIn(request, database.db)
    }
    if (request.method === "POST" && path.endsWith("/sign-up/email")) {
      return await signUp(request, database.db, env)
    }
    if (request.method === "POST" && path.endsWith("/sign-out")) {
      return await signOut(request, database.db)
    }
    if (request.method === "POST" && path.endsWith("/change-password")) {
      return await changePassword(request, database.db, env)
    }
    if (request.method === "POST" && path.endsWith("/request-password-reset")) {
      throw new AuthError(
        "PASSWORD_RESET_UNAVAILABLE",
        "密码重置邮件尚未配置，请联系管理员。",
        501,
      )
    }

    throw new AuthError("NOT_FOUND", "Auth endpoint not found.", 404)
  } catch (error) {
    if (error instanceof AuthError) return authError(error)

    console.error("Auth request failed", {
      method: request.method,
      path: new URL(request.url).pathname,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    })
    return authError(new AuthError("AUTH_INTERNAL_ERROR", "认证服务暂时不可用。", 500))
  } finally {
    await database?.close()
  }
}

async function signIn(request: Request, db: Db) {
  const input = await parseBody(request, credentialsSchema)
  const email = normalizeEmail(input.email)
  const credential = await findCredential(db, email)

  if (!credential?.password) throw invalidCredentials()
  if (!isBcryptHash(credential.password)) {
    throw new AuthError(
      "PASSWORD_MIGRATION_REQUIRED",
      "该账号需要先迁移密码，请运行 auth:migrate-password。",
      409,
    )
  }
  if (!(await verifyPassword(db, input.password, credential.password))) {
    throw invalidCredentials()
  }

  return createAuthenticatedResponse(request, db, credential.user)
}

async function signUp(request: Request, db: Db, env: RuntimeEnv) {
  const input = await parseBody(request, signUpSchema)
  if (!validatePassword(input.password)) throw invalidPassword()
  if (!(await canCreateUser(env, db))) {
    throw new AuthError("REGISTRATION_DISABLED", "用户注册已关闭。", 403)
  }

  const email = normalizeEmail(input.email)
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (existing) throw new AuthError("USER_ALREADY_EXISTS", "该邮箱已注册。", 409)

  const userId = crypto.randomUUID()
  const now = new Date()
  const password = await hashPassword(db, input.password)
  const nextUser = {
    id: userId,
    name: input.name,
    email,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction(async (tx) => {
    await tx.insert(user).values(nextUser)
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password,
      createdAt: now,
      updatedAt: now,
    })
  })
  await markUsersExist(env)

  return createAuthenticatedResponse(request, db, nextUser)
}

async function signOut(request: Request, db: Db) {
  const token = getSessionToken(request)
  if (token) await db.delete(session).where(eq(session.token, token))
  return Response.json({ success: true }, { headers: createClearSessionHeaders() })
}

async function changePassword(request: Request, db: Db, env: RuntimeEnv) {
  const input = await parseBody(request, changePasswordSchema)
  if (!validatePassword(input.newPassword)) throw invalidPassword()

  const currentSession = await resolveAuthSessionFromRequest(request, env, db)
  if (!currentSession) throw new AuthError("UNAUTHORIZED", "请先登录。", 401)

  const [credential] = await db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(and(eq(account.userId, currentSession.user.id), eq(account.providerId, "credential")))
    .limit(1)

  if (!credential?.password || !isBcryptHash(credential.password)) {
    throw new AuthError("PASSWORD_MIGRATION_REQUIRED", "该账号需要先迁移密码。", 409)
  }
  if (!(await verifyPassword(db, input.currentPassword, credential.password))) {
    throw invalidCredentials()
  }

  const nextPassword = await hashPassword(db, input.newPassword)
  await db
    .update(account)
    .set({ password: nextPassword, updatedAt: new Date() })
    .where(eq(account.id, credential.id))

  const token = getSessionToken(request)
  if (input.revokeOtherSessions && token) {
    await db
      .delete(session)
      .where(and(eq(session.userId, currentSession.user.id), ne(session.token, token)))
  }

  return Response.json({ success: true })
}

async function findCredential(db: Db, email: string) {
  const [row] = await db
    .select({
      password: account.password,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })
    .from(account)
    .innerJoin(user, eq(account.userId, user.id))
    .where(and(eq(account.providerId, "credential"), sql`lower(${user.email}) = ${email}`))
    .limit(1)

  return row
}

async function createAuthenticatedResponse(
  request: Request,
  db: Db,
  authenticatedUser: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: Date
    updatedAt: Date
  },
) {
  const token = createToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sessionId = crypto.randomUUID()

  await db.insert(session).values({
    id: sessionId,
    token,
    userId: authenticatedUser.id,
    expiresAt,
    ipAddress: request.headers.get("cf-connecting-ip"),
    userAgent: request.headers.get("user-agent"),
    createdAt: now,
    updatedAt: now,
  })

  return Response.json(
    {
      user: authenticatedUser,
      session: { id: sessionId, expiresAt, userId: authenticatedUser.id },
    },
    { headers: createSessionHeaders(request, token) },
  )
}

async function parseBody<TSchema extends z.ZodType>(request: Request, schema: TSchema) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new AuthError("INVALID_REQUEST", "请求参数不正确。", 400)
  return parsed.data as z.infer<TSchema>
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    throw new AuthError("INVALID_ORIGIN", "不允许跨站认证请求。", 403)
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function createToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
}

function invalidCredentials() {
  return new AuthError("INVALID_EMAIL_OR_PASSWORD", "邮箱或密码错误。", 401)
}

function invalidPassword() {
  return new AuthError("INVALID_PASSWORD", "密码至少 8 位，且不能超过 72 字节。", 400)
}

function authError(error: AuthError) {
  return Response.json(
    { message: error.message, code: error.code },
    { status: error.status, headers: { "cache-control": "no-store" } },
  )
}
