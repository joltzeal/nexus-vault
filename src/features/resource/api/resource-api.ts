import type {
  ResourceAnnotation,
  ResourceAnnotationPatch,
  ReadLaterResourceItem,
  StarredResourceItem,
  ResourceTransferTargetVault,
} from "../types"

type ApiEnvelope<T> = {
  data?: T
  error?: { message?: string } | null
  success?: boolean
}

export type ResourceDetailsPatch = {
  title?: string
  description?: string
  url?: string
  referer?: string
  spaceId?: string | null
}

export async function updateResourceDetails(
  resourceId: string,
  patch: ResourceDetailsPatch,
) {
  const response = await fetch(`/api/v1/resources/${encodeURIComponent(resourceId)}`, {
    body: JSON.stringify(patch),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not update resource.")
  }
  return payload?.data
}

export async function deleteResource(resourceId: string) {
  const response = await fetch(`/api/v1/resources/${encodeURIComponent(resourceId)}`, {
    credentials: "include",
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not delete resource.");
  }
}

export async function resolveResourceMetadata(resourceId: string) {
  const response = await fetch(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/metadata/resolve`,
    { credentials: "include", method: "POST" },
  );
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not retrieve metadata.");
  }
  return payload?.data;
}

async function setResourceInteraction(
  resourceId: string,
  interaction: "star" | "read-later",
  active: boolean,
) {
  const response = await fetch(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/${interaction}`,
    {
      credentials: "include",
      method: active ? "POST" : "DELETE",
    },
  )
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.error?.message ?? `Could not update resource ${interaction}.`,
    )
  }
}

export function setResourceStarred(resourceId: string, starred: boolean) {
  return setResourceInteraction(resourceId, "star", starred)
}

export function setResourceReadLater(resourceId: string, readLater: boolean) {
  return setResourceInteraction(resourceId, "read-later", readLater)
}

export async function listReadLaterResources(
  signal?: AbortSignal,
): Promise<ReadLaterResourceItem[]> {
  const response = await fetch("/api/v1/resource-read-later", {
    credentials: "include",
    signal,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    items?: ReadLaterResourceItem[]
  }> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load watch later resources.")
  }
  return payload?.data?.items ?? []
}

export async function listStarredResources(
  signal?: AbortSignal,
): Promise<StarredResourceItem[]> {
  const response = await fetch("/api/v1/resource-stars", {
    credentials: "include",
    signal,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    items?: StarredResourceItem[]
  }> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load starred resources.")
  }
  return payload?.data?.items ?? []
}

export async function listResourceTransferTargets(): Promise<
  ResourceTransferTargetVault[]
> {
  const response = await fetch("/api/v1/resources/transfer-targets", {
    credentials: "include",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    items?: ResourceTransferTargetVault[]
  }> | null

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load transfer targets.")
  }

  return payload?.data?.items ?? []
}

export async function transferResource(
  resourceId: string,
  input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  },
) {
  const response = await fetch(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/transfer`,
    {
      body: JSON.stringify(input),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  )
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    action: "move" | "copy"
    id: string
    spaceId: string
    vaultId: string
  }> | null

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not transfer resource.")
  }

  return payload?.data
}

export async function transferResources(input: {
  action: "move" | "copy"
  resourceIds: string[]
  targetVaultId: string
  targetSpaceId: string
}) {
  const response = await fetch("/api/v1/resources/transfer", {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    action: "move" | "copy"
    items: Array<{ id: string; spaceId: string; vaultId: string }>
  }> | null

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not transfer resources.")
  }

  return payload?.data
}

export async function reorderVaultResources(
  vaultId: string,
  items: Array<{ id: string; spaceId: string; position: number }>,
) {
  const response = await fetch(
    `/api/v1/vaults/${encodeURIComponent(vaultId)}/resources/reorder`,
    {
      body: JSON.stringify({ items }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  )
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    updated: number
  }> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not reorder resources.")
  }
  return payload?.data
}

export async function updateResourceAnnotation(
  resourceId: string,
  patch: ResourceAnnotationPatch,
): Promise<{ annotation: ResourceAnnotation | null }> {
  const response = await fetch(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/annotation`,
    {
      body: JSON.stringify(patch),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  )
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
    annotation: ResourceAnnotation | null
  }> | null

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not update resource annotation.")
  }

  if (!payload?.data) throw new Error("Annotation response was empty.")
  return payload.data
}
