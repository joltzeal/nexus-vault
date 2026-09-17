import { and, ilike, isNull, or, eq, sql } from "drizzle-orm"

import { collaborators, resourceMetadata, resources, spaces, vaults } from "../db/schema"
import type { Actor, Db } from "../types/legacy-api"

function matchedMetadataFields(metadata: unknown, query: string) {
  const normalizedQuery = query.toLocaleLowerCase()
  const matches = new Set<string>()
  const addMatch = (path: string[]) => {
    matches.add(`Metadata${path.length ? `.${path.join(".")}` : ""}`)
  }
  const visit = (value: unknown, path: string[]) => {
    if (typeof value === "string") {
      if (value.toLocaleLowerCase().includes(normalizedQuery)) addMatch(path)
      return
    }
    if (typeof value === "number" || typeof value === "boolean") {
      if (String(value).toLocaleLowerCase().includes(normalizedQuery)) addMatch(path)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, String(index)]))
      return
    }
    if (!value || typeof value !== "object") return
    Object.entries(value).forEach(([key, entry]) => {
      const nextPath = [...path, key]
      if (key.toLocaleLowerCase().includes(normalizedQuery)) addMatch(nextPath)
      visit(entry, nextPath)
    })
  }

  visit(metadata, [])
  const fields = [...matches]
  return fields.length > 4
    ? [...fields.slice(0, 4), `Metadata (+${fields.length - 4} more fields)`]
    : fields
}

export async function searchWorkspace(
  db: Db,
  input: { actor: Actor; query: string },
) {
  const query = input.query.trim()
  if (!query) return { vaults: [], spaces: [], resources: [] }
  // Treat SQL wildcard characters as literal search text. A query for an
  // actual URL or identifier should not silently turn into a broad match.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`
  const includesQuery = (value: string | null | undefined) =>
    value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ?? false
  const matchedFields = (
    fields: Array<[label: string, value: string | null | undefined]>,
  ) => fields.filter(([, value]) => includesQuery(value)).map(([label]) => label)
  const access = or(
    eq(vaults.ownerId, input.actor.id),
    eq(collaborators.userId, input.actor.id),
  )

  const vaultRows = await db
    .selectDistinct({ id: vaults.id, title: vaults.title, description: vaults.description })
    .from(vaults)
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(isNull(vaults.deletedAt), access, or(ilike(vaults.title, pattern), ilike(vaults.description, pattern))))
    .limit(8)

  const spaceRows = await db
    .selectDistinct({ id: spaces.id, name: spaces.name, description: spaces.description, vaultId: spaces.vaultId, vaultTitle: vaults.title })
    .from(spaces)
    .innerJoin(vaults, eq(vaults.id, spaces.vaultId))
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(isNull(spaces.deletedAt), isNull(vaults.deletedAt), access, or(ilike(spaces.name, pattern), ilike(spaces.description, pattern), ilike(vaults.title, pattern))))
    .limit(12)

  const resourceRows = await db
    .selectDistinct({ id: resources.id, title: resources.title, description: resources.description, url: resources.url, vaultId: resources.vaultId, vaultTitle: vaults.title, spaceId: resources.spaceId, spaceName: spaces.name, metadataDataJson: resourceMetadata.dataJson })
    .from(resources)
    .leftJoin(vaults, eq(vaults.id, resources.vaultId))
    .leftJoin(spaces, eq(spaces.id, resources.spaceId))
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .where(and(or(eq(resources.stashUserId, input.actor.id), and(isNull(vaults.deletedAt), access)), or(ilike(resources.title, pattern), ilike(resources.url, pattern), ilike(resources.description, pattern), ilike(vaults.title, pattern), ilike(spaces.name, pattern), ilike(sql<string>`${resourceMetadata.dataJson}::text`, pattern))))
    .limit(24)

  return {
    vaults: vaultRows.map((vault) => ({
      ...vault,
      matchedFields: matchedFields([
        ["Vault name", vault.title],
        ["Description", vault.description],
      ]),
    })),
    spaces: spaceRows.map((space) => ({
      ...space,
      matchedFields: matchedFields([
        ["Space name", space.name],
        ["Description", space.description],
        ["Vault", space.vaultTitle],
      ]),
    })),
    resources: resourceRows.map(({ metadataDataJson, vaultId, vaultTitle, ...resource }) => ({
      ...resource,
      vaultId: vaultId ?? "flash-stash",
      vaultTitle: vaultTitle ?? "Flash stash",
      matchedFields: [
        ...matchedFields([
          ["Resource title", resource.title],
          ["Description", resource.description],
          ["URL", resource.url],
          ["Vault", vaultTitle],
          ["Space", resource.spaceName],
        ]),
        ...matchedMetadataFields(metadataDataJson, query),
      ],
    })),
  }
}
