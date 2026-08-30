import { and, eq, or } from "drizzle-orm"

import { collaborators, users, vaults } from "../db/schema"
import { can, type PermissionAction } from "../domain/vaults/permissions"
import { forbidden, notFound } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"

export async function getVaultRoleForEmail(db: Db, vaultId: string, email?: string) {
  if (!email) return "anonymous" as const

  const [row] = await db
    .select({
      role: collaborators.role,
    })
    .from(collaborators)
    .innerJoin(users, eq(collaborators.userId, users.id))
    .where(and(eq(collaborators.vaultId, vaultId), eq(users.email, email)))
    .limit(1)

  return row?.role ?? ("anonymous" as const)
}

export async function getVaultRoleForActor(db: Db, vaultId: string, actor?: Actor) {
  if (!actor) return "anonymous" as const

  const [vault] = await db
    .select({
      ownerId: vaults.ownerId,
    })
    .from(vaults)
    .where(eq(vaults.id, vaultId))
    .limit(1)

  if (vault?.ownerId === actor.id) return "owner" as const

  const [row] = await db
    .select({
      role: collaborators.role,
    })
    .from(collaborators)
    .innerJoin(users, eq(collaborators.userId, users.id))
    .where(
      and(
        eq(collaborators.vaultId, vaultId),
        or(eq(collaborators.userId, actor.id), eq(users.email, actor.email))
      )
    )
    .limit(1)

  return row?.role ?? ("anonymous" as const)
}

export async function requireVaultPermission(
  db: Db,
  input: {
    vaultId: string
    actor?: Actor
    userEmail?: string
    action: PermissionAction
  }
) {
  const role = input.actor
    ? await getVaultRoleForActor(db, input.vaultId, input.actor)
    : await getVaultRoleForEmail(db, input.vaultId, input.userEmail)

  if (!can(role, input.action)) {
    throw forbidden(`Missing permission: ${input.action}`)
  }

  return role
}

export async function requireVaultRead(
  db: Db,
  input: {
    vaultId: string
    actor?: Actor
    userEmail?: string
  }
) {
  const [vault] = await db
    .select({
      id: vaults.id,
      visibility: vaults.visibility,
      deletedAt: vaults.deletedAt,
    })
    .from(vaults)
    .where(eq(vaults.id, input.vaultId))
    .limit(1)

  if (!vault || vault.deletedAt) throw notFound("Vault not found.")

  if (vault.visibility === "public") {
    return "anonymous" as const
  }

  return requireVaultPermission(db, {
    vaultId: input.vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:read",
  })
}
