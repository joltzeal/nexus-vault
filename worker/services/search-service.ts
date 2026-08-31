import { and, ilike, isNull, or, eq } from "drizzle-orm"

import { collaborators, resources, spaces, vaults } from "../db/schema"
import type { Actor, Db } from "../types/legacy-api"

export async function searchWorkspace(
  db: Db,
  input: { actor: Actor; query: string },
) {
  const query = input.query.trim()
  if (!query) return { vaults: [], spaces: [], resources: [] }
  const pattern = `%${query}%`
  const access = or(
    eq(vaults.ownerId, input.actor.id),
    eq(collaborators.userId, input.actor.id),
  )

  const vaultRows = await db
    .selectDistinct({ id: vaults.id, title: vaults.title })
    .from(vaults)
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(isNull(vaults.deletedAt), access, or(ilike(vaults.title, pattern), ilike(vaults.description, pattern))))
    .limit(8)

  const spaceRows = await db
    .selectDistinct({ id: spaces.id, name: spaces.name, vaultId: spaces.vaultId, vaultTitle: vaults.title })
    .from(spaces)
    .innerJoin(vaults, eq(vaults.id, spaces.vaultId))
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(isNull(spaces.deletedAt), isNull(vaults.deletedAt), access, or(ilike(spaces.name, pattern), ilike(spaces.description, pattern))))
    .limit(12)

  const resourceRows = await db
    .selectDistinct({ id: resources.id, title: resources.title, url: resources.url, vaultId: resources.vaultId, vaultTitle: vaults.title, spaceId: resources.spaceId, spaceName: spaces.name })
    .from(resources)
    .innerJoin(vaults, eq(vaults.id, resources.vaultId))
    .leftJoin(spaces, eq(spaces.id, resources.spaceId))
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(isNull(vaults.deletedAt), access, or(ilike(resources.title, pattern), ilike(resources.url, pattern), ilike(resources.description, pattern))))
    .limit(20)

  return { vaults: vaultRows, spaces: spaceRows, resources: resourceRows }
}

