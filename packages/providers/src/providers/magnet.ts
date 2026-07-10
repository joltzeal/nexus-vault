import {
  createBaseResourceMetadata,
  type ResourceFileType,
} from "@nexus-vault/shared/resource-metadata"
import {
  createCanonicalMagnetUrl,
  parseMagnetLink,
} from "@nexus-vault/shared/resource-input"

import type { MetadataProvider } from "../metadata-provider"

const WHATSLINK_API_URL = "https://whatslink.info/api/v1/link"
const WHATSLINK_ATTRIBUTION = {
  label: "whatslink.info",
  url: "https://whatslink.info",
}

export const magnetMetadataProvider: MetadataProvider = {
  name: "whatslink",
  supports: (resource) => resource.type === "magnet",
  async resolve(resource) {
    const parsed = parseMagnetLink(resource.url)
    const fallbackTitle = parsed?.displayName || resource.title || "名称未知"

    if (!parsed) {
      return {
        provider: "whatslink",
        status: "failed",
        data: createBaseResourceMetadata({
          type: "magnet",
          title: resource.title || "名称未知",
        }),
        errorMessage: "Invalid magnet link.",
      }
    }

    const baseMetadata = createBaseResourceMetadata({
      type: "magnet",
      title: fallbackTitle,
    })

    try {
      const whatslink = await fetchWhatsLinkMetadata(parsed.infoHash)

      return {
        provider: "whatslink",
        status: "completed",
        data: {
          ...baseMetadata,
          title: whatslink.name || fallbackTitle,
          cover: whatslink.screenshots?.[0],
          size: whatslink.size,
          fileCount: whatslink.count,
          fileType: whatslink.fileType,
          screenshots: whatslink.screenshots,
          identifiers: {
            infoHash: parsed.infoHash,
          },
          source: {
            name: "whatslink",
            url: WHATSLINK_API_URL,
            attribution: WHATSLINK_ATTRIBUTION,
          },
          extra: {
            magnet: {
              infoHash: parsed.infoHash,
            },
            whatslink: {
              type: whatslink.type,
              fileType: whatslink.fileType,
            },
          },
        },
      }
    } catch (error) {
      return {
        provider: "whatslink",
        status: "completed",
        data: {
          ...baseMetadata,
          identifiers: {
            infoHash: parsed.infoHash,
          },
          source: {
            name: "local-magnet-parser",
          },
          extra: {
            magnet: {
              infoHash: parsed.infoHash,
            },
            metadataWarning:
              error instanceof Error ? error.message : "Whatslink metadata request failed.",
          },
        },
      }
    }
  },
}

type WhatsLinkMetadata = {
  type?: string
  fileType?: ResourceFileType
  name?: string
  size?: number
  count?: number
  screenshots?: string[]
}

async function fetchWhatsLinkMetadata(infoHash: string): Promise<WhatsLinkMetadata> {
  const endpoint = new URL(WHATSLINK_API_URL)
  endpoint.searchParams.set("url", createCanonicalMagnetUrl(infoHash))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Whatslink request failed with HTTP ${response.status}.`)
    }

    return normalizeWhatsLinkResponse(await response.json())
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeWhatsLinkResponse(payload: unknown): WhatsLinkMetadata {
  const record = isRecord(payload) ? payload : {}

  return {
    type: stringValue(record.type),
    fileType: resourceFileTypeValue(record.file_type),
    name: stringValue(record.name),
    size: numberValue(record.size),
    count: numberValue(record.count),
    screenshots: screenshotArrayValue(record.screenshots),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function screenshotArrayValue(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (isRecord(item)) return stringValue(item.screenshot)
      return undefined
    })
    .filter((item): item is string => Boolean(item))

  return items.length > 0 ? items : undefined
}

function resourceFileTypeValue(value: unknown): ResourceFileType | undefined {
  const allowed = new Set<ResourceFileType>([
    "unknown",
    "folder",
    "video",
    "text",
    "image",
    "audio",
    "archive",
    "font",
    "document",
  ])
  return typeof value === "string" && allowed.has(value as ResourceFileType)
    ? (value as ResourceFileType)
    : undefined
}
