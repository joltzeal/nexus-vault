import "server-only"

import { and, desc, eq, gt, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getAuthSecret, type AuthRuntimeEnv } from "@/auth/config"
import { getSessionCookieValues } from "@/auth/cookies"
import { createDbSession, type Db } from "@/db"
import { session as authSessions, user as authUsers } from "@/db/auth-schema"

export type Viewer = {
  id: string
  email: string
  name: string | null
  image: string | null
}

const textEncoder = new TextEncoder()
let hmacKeyCache:
  | {
      secret: string
      key: CryptoKey
    }
  | undefined

export async function resolveAuthSessionFromRequest(
  request: Request | Headers,
  env?: Partial<CloudflareEnv>,
  db?: Db,
) {
  const tokens = await getVerifiedSessionTokens(request, env)
  if (tokens.length === 0) return null

  if (db) return findAuthSession(db, tokens)

  const database = await createDbSession(env)
  try {
    return await findAuthSession(database.db, tokens)
  } finally {
    await database.close()
  }
}

export async function resolveViewerFromRequest(
  request: Request | Headers,
  env?: Partial<CloudflareEnv>,
  db?: Db,
): Promise<Viewer | null> {
  const authSession = await resolveAuthSessionFromRequest(request, env, db)
  if (!authSession) return null

  return {
    id: authSession.user.id,
    email: authSession.user.email,
    name: authSession.user.name,
    image: authSession.user.image,
  }
}

export async function getViewer(env?: Partial<CloudflareEnv>): Promise<Viewer | null> {
  return resolveViewerFromRequest(new Headers(await headers()), env)
}

export async function requireViewer(env?: Partial<CloudflareEnv>) {
  const viewer = await getViewer(env)
  if (!viewer) redirect("/")
  return viewer
}

async function findAuthSession(db: Db, tokens: string[]) {
  const [row] = await db
    .select({
      session: {
        id: authSessions.id,
        expiresAt: authSessions.expiresAt,
        token: authSessions.token,
        createdAt: authSessions.createdAt,
        updatedAt: authSessions.updatedAt,
        ipAddress: authSessions.ipAddress,
        userAgent: authSessions.userAgent,
        userId: authSessions.userId,
      },
      user: {
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        emailVerified: authUsers.emailVerified,
        image: authUsers.image,
        createdAt: authUsers.createdAt,
        updatedAt: authUsers.updatedAt,
      },
    })
    .from(authSessions)
    .innerJoin(authUsers, eq(authSessions.userId, authUsers.id))
    .where(
      and(
        inArray(authSessions.token, tokens),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(authSessions.updatedAt), desc(authSessions.createdAt))
    .limit(1)

  return row ?? null
}

async function getVerifiedSessionTokens(
  request: Request | Headers,
  env?: Partial<CloudflareEnv>,
) {
  const values = getSessionCookieValues(request)
  if (values.length === 0) return []

  const secret = getAuthSecret((env ?? {}) as AuthRuntimeEnv)
  const key = await getHmacKey(secret)
  const candidates = values.flatMap((value) => {
    const candidate = parseSignedSessionValue(value)
    return candidate ? [candidate] : []
  })

  const verified = await Promise.all(
    candidates.map(async ({ token, signature }) => ({
      token,
      valid: await crypto.subtle.verify(
        "HMAC",
        key,
        signature,
        textEncoder.encode(token),
      ).catch(() => false),
    })),
  )

  return [...new Set(verified.filter(({ valid }) => valid).map(({ token }) => token))]
}

async function getHmacKey(secret: string) {
  if (hmacKeyCache?.secret === secret) return hmacKeyCache.key

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  hmacKeyCache = { secret, key }
  return key
}

function parseSignedSessionValue(signedValue: string) {
  if (signedValue.length > 1024) return null

  const separator = signedValue.lastIndexOf(".")
  if (separator <= 0) return null

  const token = signedValue.slice(0, separator)
  const signature = signedValue.slice(separator + 1)
  if (!token || token.length > 512 || !signature || signature.length > 256) return null

  try {
    const normalizedSignature = signature.replace(/-/g, "+").replace(/_/g, "/")
    const paddedSignature = normalizedSignature.padEnd(
      Math.ceil(normalizedSignature.length / 4) * 4,
      "=",
    )
    return {
      token,
      signature: Uint8Array.from(atob(paddedSignature), (character) =>
        character.charCodeAt(0),
      ),
    }
  } catch {
    return null
  }
}
