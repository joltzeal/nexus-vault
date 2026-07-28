import { and, eq } from "drizzle-orm"

import { collaborators, users } from "@/db/schema"
import type { Actor, Db } from "@/server/api/types"
import { ensureUser } from "@/server/services/user-service"
import { requireVaultPermission } from "@/server/services/permission-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export async function listCollaborators(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor
    actorEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.actorEmail,
    action: "collaborator:manage",
  })

  return db
    .select({
      id: collaborators.id,
      role: collaborators.role,
      userId: users.id,
      email: users.email,
      name: users.name,
      createdAt: collaborators.createdAt,
    })
    .from(collaborators)
    .innerJoin(users, eq(collaborators.userId, users.id))
    .where(and(eq(collaborators.vaultId, vaultId), eq(collaborators.role, "editor")))
}

export async function upsertCollaborator(
  db: Db,
  vaultId: string,
  input: {
    email: string
    name?: string
    actor?: Actor
    actorEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.actorEmail,
    action: "collaborator:manage",
  })

  const userId = await ensureUser(db, {
    email: input.email,
    name: input.name,
  })

  const [existing] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(and(eq(collaborators.vaultId, vaultId), eq(collaborators.userId, userId)))
    .limit(1)

  if (existing) {
    await db
      .update(collaborators)
      .set({ role: "editor", updatedAt: new Date().toISOString() })
      .where(eq(collaborators.id, existing.id))
    return { id: existing.id, userId }
  }

  const collaboratorId = newId()
  await db.insert(collaborators).values({
    id: collaboratorId,
    vaultId,
    userId,
    role: "editor",
  })

  return { id: collaboratorId, userId }
}

export async function removeCollaborator(
  db: Db,
  vaultId: string,
  collaboratorId: string,
  input: {
    actor?: Actor
    actorEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.actorEmail,
    action: "collaborator:manage",
  })

  const [existing] = await db
    .select({
      id: collaborators.id,
      role: collaborators.role,
    })
    .from(collaborators)
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.vaultId, vaultId)))
    .limit(1)

  if (!existing) return { id: collaboratorId, removed: false }

  await db.delete(collaborators).where(eq(collaborators.id, collaboratorId))
  return { id: collaboratorId, removed: true }
}

export async function ensureEditorCollaborator(
  db: Db,
  vaultId: string,
  userId: string
) {
  const [existing] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(and(eq(collaborators.vaultId, vaultId), eq(collaborators.userId, userId)))
    .limit(1)

  if (existing) {
    await db
      .update(collaborators)
      .set({ role: "editor", updatedAt: new Date().toISOString() })
      .where(eq(collaborators.id, existing.id))
    return { id: existing.id, userId }
  }

  const collaboratorId = newId()
  await db.insert(collaborators).values({
    id: collaboratorId,
    vaultId,
    userId,
    role: "editor",
  })

  return { id: collaboratorId, userId }
}
