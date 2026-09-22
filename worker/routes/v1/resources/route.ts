import { handleApiRequest, ok, parseJson, requireActor } from "../../../lib/http"
import { ApiError } from "../../../lib/errors"
import { createResourceWithVaultSchema } from "../../../schemas/resource"
import { createResource } from "../../../services/resource-service"
import { enqueueMetadataTask } from "../../../services/metadata-service"
import { listResources } from "../../../services/vault-service"

function optionalQueryValue(value: string | null) {
  return value?.trim() || undefined
}

function resourcePageLimit(value: string | null) {
  if (value === null || value === "") return undefined
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(
      "INVALID_RESOURCE_PAGE",
      "Resource page limit must be an integer between 1 and 50.",
    )
  }
  return limit
}

export function GET(request: Request) {
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, url }) => {
    const vaultId = optionalQueryValue(url.searchParams.get("vaultId"))
    const spaceId = optionalQueryValue(url.searchParams.get("spaceId"))
    const cursor = optionalQueryValue(url.searchParams.get("cursor"))
    if (!vaultId && !spaceId) {
      throw new ApiError(
        "RESOURCE_SCOPE_REQUIRED",
        "Provide either vaultId or spaceId when listing resources.",
      )
    }
    if (cursor && cursor.length > 1_000) {
      throw new ApiError("INVALID_RESOURCE_CURSOR", "Resource cursor is invalid.")
    }

    return ok(await listResources(db, {
      actor,
      cursor,
      limit: resourcePageLimit(url.searchParams.get("limit")),
      spaceId,
      vaultId,
    }))
  })
}

export function POST(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, createResourceWithVaultSchema)
    const result = await createResource(context.db, input.vaultId, {
      ...input,
      actor: requireActor(context.actor),
    })
    enqueueMetadataTask(context, result.metadataTask)
    return ok(result, 201)
  })
}
