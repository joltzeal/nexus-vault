import type { NormalizedResourceMetadata } from "./metadata"

export type MetadataUpdateMode = "replace" | "availability-only"

export function selectMetadataForPersistence(input: {
  mode?: MetadataUpdateMode
  next: NormalizedResourceMetadata
  previous: NormalizedResourceMetadata | null
  status: "pending" | "processing" | "completed" | "failed"
}) {
  const { next, previous, status } = input
  if (!previous) return { data: next, preserved: false }

  const availability = getCloudDriveAvailability(next)
  const shouldPreserve =
    input.mode === "availability-only" ||
    status === "failed" ||
    Boolean(availability && availability.status !== "available")

  if (!shouldPreserve) return { data: next, preserved: false }
  if (!availability) return { data: previous, preserved: true }

  const previousCloudDrive = getRecord(previous.extra?.cloudDrive)

  return {
    data: {
      ...previous,
      extra: {
        ...previous.extra,
        cloudDrive: {
          ...previousCloudDrive,
          availability,
        },
      },
    } satisfies NormalizedResourceMetadata,
    preserved: true,
  }
}

function getCloudDriveAvailability(metadata: NormalizedResourceMetadata) {
  const cloudDrive = getRecord(metadata.extra?.cloudDrive)
  const availability = getRecord(cloudDrive?.availability)
  const status = availability?.status

  return typeof status === "string"
    ? availability
    : undefined
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined
}
