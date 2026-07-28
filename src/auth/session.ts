import "server-only"

import { and, desc, eq, gt } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionToken } from "@/auth/cookies"
import { createDbSession, type Db } from "@/db"
import { session as authSessions, user as authUsers } from "@/db/auth-schema"

export type Viewer = {
  id: string
  email: string
  name: string | null
  image: string | null
}

export async function resolveAuthSessionFromRequest(
  request: Request | Headers,
  _env?: Partial<CloudflareEnv>,
  db?: Db,
) {
  const token = getSessionToken(request)
  if (!token) return null

  if (db) return findAuthSession(db, token)

  const database = await createDbSession(_env)
  try {
    return await findAuthSession(database.db, token)
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

async function findAuthSession(db: Db, token: string) {
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
    .where(and(eq(authSessions.token, token), gt(authSessions.expiresAt, new Date())))
    .orderBy(desc(authSessions.updatedAt))
    .limit(1)

  return row ?? null
}
