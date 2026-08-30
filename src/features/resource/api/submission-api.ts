import type {
  ResourceSubmissionForm,
  ResourceSubmissionItem,
  ResourceSubmissionReviewForm,
  ResourceSubmissionStatus,
} from "../types"

type ApiEnvelope<T> = {
  data?: T
  error?: { message?: string } | null
  success?: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message ?? `Request failed (${response.status})`)
  }
  if (payload?.data === undefined) throw new Error("Response data was empty.")
  return payload.data
}

export type ResourceSubmissionResult = {
  id: string
  status: ResourceSubmissionStatus
}

export type ResourceSubmissionReviewResult = {
  id: string
  status: ResourceSubmissionStatus
  resourceId?: string
}

export function submitSharedResource(shareSlug: string, form: ResourceSubmissionForm) {
  return request<ResourceSubmissionResult>(`/shares/${encodeURIComponent(shareSlug)}/submissions`, {
    body: JSON.stringify({
      description: form.description,
      referer: form.referer,
      spaceId: form.spaceId || undefined,
      title: form.title.trim() || undefined,
      turnstileToken: form.turnstileToken,
      type: form.type,
      url: form.url.trim(),
    }),
    method: "POST",
  })
}

export function listVaultResourceSubmissions(
  vaultId: string,
  status: ResourceSubmissionStatus = "pending",
  signal?: AbortSignal,
) {
  return request<{ items: ResourceSubmissionItem[] }>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions?status=${encodeURIComponent(status)}`,
    { signal },
  ).then((result) => result.items)
}

export function approveVaultResourceSubmission(
  vaultId: string,
  submissionId: string,
  form: ResourceSubmissionReviewForm,
) {
  return request<ResourceSubmissionReviewResult>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions/${encodeURIComponent(submissionId)}/approve`,
    {
      body: JSON.stringify({ spaceId: form.spaceId || undefined, note: form.note.trim() || undefined }),
      method: "POST",
    },
  )
}

export function rejectVaultResourceSubmission(
  vaultId: string,
  submissionId: string,
  form: ResourceSubmissionReviewForm,
) {
  return request<ResourceSubmissionReviewResult>(
    `/vaults/${encodeURIComponent(vaultId)}/submissions/${encodeURIComponent(submissionId)}/reject`,
    {
      body: JSON.stringify({ note: form.note.trim() || undefined }),
      method: "POST",
    },
  )
}
