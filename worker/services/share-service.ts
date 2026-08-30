import { and, eq, isNull } from "drizzle-orm"

import { shares, vaults } from "../db/schema"
import { forbidden, validationFailed } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import {
  getVaultRoleForActor,
  requireVaultPermission,
} from "./permission-service"
import { getVaultOrThrow, readVaultDetail } from "./vault-service"
import { newId, newShareSlug, newToken } from "../lib/id"

const SHARE_UNLOCK_TTL_SECONDS = 60 * 60 * 12

export async function getShare(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor
    userEmail?: string
  }
) {
  const vault = await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "share:manage",
  })

  const [share] = await db
    .select({
      id: shares.id,
      token: shares.token,
      slug: shares.slug,
      createdAt: shares.createdAt,
      updatedAt: shares.updatedAt,
    })
    .from(shares)
    .where(and(eq(shares.vaultId, vaultId), isNull(shares.deletedAt)))
    .limit(1)

  if (!share) {
    const shareId = newId()
    const slug = await createUniqueShareSlug(db)
    await db.insert(shares).values({
      id: shareId,
      vaultId,
      visibility: vault.visibility,
      passwordHash: null,
      token: newToken(),
      slug,
    })

    return {
      id: shareId,
      visibility: vault.visibility,
      token: undefined,
      slug,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
    }
  }

  if (!share.slug) {
    const slug = await createUniqueShareSlug(db)
    await db.update(shares).set({ slug }).where(eq(shares.id, share.id))
    return { ...share, visibility: vault.visibility, slug }
  }

  return { ...share, visibility: vault.visibility }
}

export async function upsertShare(
  db: Db,
  vaultId: string,
  input: {
    visibility: "public" | "private" | "password"
    passwordHash?: string | null
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "share:manage",
  })

  if (input.visibility === "password" && !input.passwordHash) {
    throw validationFailed({
      fieldErrors: {
        passwordHash: ["Password visibility requires a hash."],
      },
    })
  }

  const [existing] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(and(eq(shares.vaultId, vaultId), isNull(shares.deletedAt)))
    .limit(1)

  await db
    .update(vaults)
    .set({
      visibility: input.visibility,
      passwordHash: input.visibility === "password" ? input.passwordHash : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(vaults.id, vaultId))

  if (existing) {
    const slug = await ensureShareSlug(db, existing.id)
    await db
      .update(shares)
      .set({
        slug,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shares.id, existing.id))
    return { id: existing.id, slug }
  }

  const shareId = newId()
  const slug = await createUniqueShareSlug(db)
  await db.insert(shares).values({
    id: shareId,
    vaultId,
    visibility: "private",
    passwordHash: null,
    token: newToken(),
    slug,
  })

  return { id: shareId, slug }
}

export async function unlockSharedVaultBySlug(
  db: Db,
  env: CloudflareEnv,
  slug: string,
  input: {
    passwordHash: string
  }
) {
  const share = await findActiveShareBySlug(db, slug)

  if (!share || share.vaultVisibility === "private") {
    throw forbidden("Share link is not available.")
  }

  if (share.vaultVisibility !== "password") {
    return {
      vaultId: share.vaultId,
      passwordRequired: false,
      unlockToken: null,
      maxAge: 0,
    }
  }

  if (!share.vaultPasswordHash || share.vaultPasswordHash !== input.passwordHash) {
    throw forbidden("Invalid share password.")
  }

  return {
    vaultId: share.vaultId,
    passwordRequired: false,
    unlockToken: await signShareUnlockToken(env, {
      slug,
      vaultId: share.vaultId,
      passwordHash: share.vaultPasswordHash,
    }),
    maxAge: SHARE_UNLOCK_TTL_SECONDS,
  }
}

export async function getUnlockedSharedVaultDetail(
  db: Db,
  env: CloudflareEnv,
  slug: string,
  unlockToken?: string,
  input: { actor?: Actor } = {}
) {
  const share = await findActiveShareBySlug(db, slug)

  if (!share) return null
  if (share.vaultVisibility === "private") {
    return {
      passwordRequired: false as const,
      unavailable: true as const,
      actorRole: "anonymous" as const,
      detail: null,
    }
  }
  if (share.vaultVisibility === "password") {
    const isUnlocked = await verifyShareUnlockToken(env, unlockToken, {
      slug,
      vaultId: share.vaultId,
      passwordHash: share.vaultPasswordHash,
    })

    if (!isUnlocked) {
      return {
        passwordRequired: true as const,
        unavailable: false as const,
        actorRole: "anonymous" as const,
        detail: null,
      }
    }
  }

  return {
    passwordRequired: false as const,
    unavailable: false as const,
    actorRole: await getVaultRoleForActor(db, share.vaultId, input.actor),
    detail: await readVaultDetail(db, share.vaultId, { actor: input.actor }),
  }
}

export async function getShareVaultTitleBySlug(db: Db, slug: string) {
  const [share] = await db
    .select({
      title: vaults.title,
      visibility: vaults.visibility,
      deletedAt: shares.deletedAt,
    })
    .from(shares)
    .innerJoin(vaults, eq(shares.vaultId, vaults.id))
    .where(and(eq(shares.slug, slug), isNull(vaults.deletedAt)))
    .limit(1)

  if (!share || share.deletedAt) return null
  if (share.visibility === "private") return "Vault 不可用"

  return share.title
}

export function getShareUnlockCookieName(slug: string) {
  return `nv_share_${slug.replace(/[^a-zA-Z0-9_-]/g, "")}`
}

export function getShareUnlockCookieOptions(
  _slug: string,
  maxAge: number,
  input: {
    secure: boolean
  }
) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "Lax" as const,
    secure: input.secure,
  }
}

async function findActiveShareBySlug(db: Db, slug: string) {
  const [share] = await db
    .select({
      vaultId: shares.vaultId,
      vaultVisibility: vaults.visibility,
      vaultPasswordHash: vaults.passwordHash,
      deletedAt: shares.deletedAt,
    })
    .from(shares)
    .innerJoin(vaults, eq(shares.vaultId, vaults.id))
    .where(and(eq(shares.slug, slug), isNull(vaults.deletedAt)))
    .limit(1)

  if (!share || share.deletedAt) return null
  return share
}

async function signShareUnlockToken(
  env: CloudflareEnv,
  input: {
    slug: string
    vaultId: string
    passwordHash: string
  }
) {
  const expiresAt = Math.floor(Date.now() / 1000) + SHARE_UNLOCK_TTL_SECONDS
  const payload = `${input.slug}.${input.vaultId}.${expiresAt}.${input.passwordHash}`
  const signature = await hmacSha256Hex(getShareSecret(env), payload)

  return `${expiresAt}.${signature}`
}

async function verifyShareUnlockToken(
  env: CloudflareEnv,
  token: string | undefined,
  input: {
    slug: string
    vaultId: string
    passwordHash: string | null
  }
) {
  if (!token || !input.passwordHash) return false

  const [expiresAtValue, signature] = token.split(".")
  const expiresAt = Number(expiresAtValue)
  if (!expiresAt || !signature || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false
  }

  const payload = `${input.slug}.${input.vaultId}.${expiresAt}.${input.passwordHash}`
  const expected = await hmacSha256Hex(getShareSecret(env), payload)

  return timingSafeEqual(signature, expected)
}

function getShareSecret(env: CloudflareEnv) {
  return env.BETTER_AUTH_SECRET
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

async function ensureShareSlug(db: Db, shareId: string) {
  const [share] = await db
    .select({ slug: shares.slug })
    .from(shares)
    .where(eq(shares.id, shareId))
    .limit(1)

  return share?.slug ?? createUniqueShareSlug(db)
}

async function createUniqueShareSlug(db: Db) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = newShareSlug()
    const [existing] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(eq(shares.slug, slug))
      .limit(1)

    if (!existing) return slug
  }

  return newToken().replaceAll("-", "").slice(0, 12)
}
