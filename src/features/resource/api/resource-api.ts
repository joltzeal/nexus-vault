import type {
  ResourceAnnotation,
  ResourceAnnotationPatch,
  ReadLaterResourceItem,
  Resource,
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

export async function getResource(resourceId: string): Promise<Resource> {
  const response = await fetch(`/api/v1/resources/${encodeURIComponent(resourceId)}`, {
    credentials: "include",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<Resource> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load resource.")
  }
  if (!payload?.data) throw new Error("Resource response was empty.")
  return payload.data
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

export type ResourceAiSummaryStreamUpdate = {
  aiSummary: {
    error?: string
    status: Resource["metadataStatus"]
    text?: string
  } | null
  description: string
  id: string
  metadataStatus: Resource["metadataStatus"]
}

export async function streamResourceAiSummary(
  resourceId: string,
  options: {
    onUpdate: (update: ResourceAiSummaryStreamUpdate) => void
    signal?: AbortSignal
  },
): Promise<boolean> {
  const response = await fetch(
    `/api/v1/resources/${encodeURIComponent(resourceId)}/metadata/stream`,
    { credentials: "include", signal: options.signal },
  )
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
    throw new Error(payload?.error?.message ?? "Could not stream AI summary.")
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("AI summary stream returned no body.")

  const decoder = new TextDecoder()
  let buffer = ""
  let receivedTerminalUpdate = false

  const handleUpdate = (update: ResourceAiSummaryStreamUpdate) => {
    if (
      update.aiSummary?.status === "completed" ||
      update.aiSummary?.status === "failed"
    ) {
      receivedTerminalUpdate = true
    }
    options.onUpdate(update)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = consumeSseEvents(buffer, handleUpdate)
    }

    buffer += decoder.decode()
    consumeSseEvents(buffer, handleUpdate, true)
  } finally {
    reader.releaseLock()
  }
  return receivedTerminalUpdate
}

function consumeSseEvents(
  value: string,
  onUpdate: (update: ResourceAiSummaryStreamUpdate) => void,
  flush = false,
) {
  let buffer = value
  while (true) {
    const match = buffer.match(/\r?\n\r?\n/)
    if (!match || match.index === undefined) break
    const block = buffer.slice(0, match.index)
    buffer = buffer.slice(match.index + match[0].length)
    dispatchSseEvent(block, onUpdate)
  }

  if (flush && buffer.trim()) {
    dispatchSseEvent(buffer, onUpdate)
    return ""
  }
  return buffer
}

function dispatchSseEvent(
  block: string,
  onUpdate: (update: ResourceAiSummaryStreamUpdate) => void,
) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
  if (!data) return

  const parsed = JSON.parse(data) as ResourceAiSummaryStreamUpdate | { message?: string }
  if (!isResourceAiSummaryStreamUpdate(parsed)) {
    throw new Error(
      typeof parsed === "object" && parsed && "message" in parsed && typeof parsed.message === "string"
        ? parsed.message
        : "AI summary stream returned invalid data.",
    )
  }
  onUpdate(parsed)
}

function isResourceAiSummaryStreamUpdate(
  value: unknown,
): value is ResourceAiSummaryStreamUpdate {
  if (!value || typeof value !== "object") return false
  const update = value as Record<string, unknown>
  if (
    typeof update.id !== "string" ||
    typeof update.description !== "string" ||
    !isMetadataStatus(update.metadataStatus)
  ) {
    return false
  }
  if (update.aiSummary === null) return true
  if (!update.aiSummary || typeof update.aiSummary !== "object") return false
  const summary = update.aiSummary as Record<string, unknown>
  return isMetadataStatus(summary.status) &&
    (summary.text === undefined || typeof summary.text === "string")
}

function isMetadataStatus(value: unknown): value is Resource["metadataStatus"] {
  return value === "pending" || value === "processing" || value === "completed" || value === "failed"
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

export async function listStashResources(signal?: AbortSignal): Promise<Resource[]> {
  const response = await fetch("/api/v1/resource-stash", { credentials: "include", signal })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{ items?: Resource[] }> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not load flash stash.")
  }
  return payload?.data?.items ?? []
}

export async function createStashResource(form: {
  title: string
  url: string
  referer: string
  extractionCode: string
  description: string
}) {
  const response = await fetch("/api/v1/resource-stash", {
    body: JSON.stringify({
      description: form.description,
      extractionCode: form.extractionCode || undefined,
      referer: form.referer || undefined,
      title: form.title.trim() || undefined,
      url: form.url,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<{ id: string }> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not add resource to flash stash.")
  }
  return payload?.data
}

export async function organizeStashResource(
  resourceId: string,
  input: { targetVaultId: string; targetSpaceId: string },
) {
  const response = await fetch(`/api/v1/resource-stash/resources/${encodeURIComponent(resourceId)}/organize`, {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? "Could not organize resource.")
  }
  return payload?.data
}
