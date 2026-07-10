import { createBaseResourceMetadata } from "@nexus-vault/shared/resource-metadata"
import { parseCloudDriveLink } from "@nexus-vault/shared/resource-input"

import type { MetadataProvider } from "../metadata-provider"

export const cloudDriveMetadataProvider: MetadataProvider = {
  name: "cloud-drive-link-parser",
  supports: (resource) => resource.type === "baidu_pan" || resource.type === "quark_pan",
  async resolve(resource) {
    const parsed = parseCloudDriveLink(resource.url)
    const provider = parsed?.provider ?? resource.type
    const availability = await checkCloudDriveAvailability(
      parsed?.url ?? resource.url,
      provider
    )
    const title =
      provider === "baidu_pan"
        ? "Baidu Netdisk link"
        : provider === "quark_pan"
          ? "Quark Cloud Drive link"
          : resource.title

    return {
      provider: `${provider}-link-parser`,
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: resource.type,
          title: resource.title,
        }),
        title: resource.title || title,
        source: {
          name: `${provider}-link-parser`,
          url: resource.url,
        },
        extra: {
          cloudDrive: {
            provider,
            host: parsed?.host,
            url: parsed?.url ?? resource.url,
            password: parsed?.password,
            shareId: parsed?.shareId,
            availability,
          },
        },
      },
    }
  },
}

type CloudDriveAvailability = {
  status: "available" | "unavailable" | "unknown"
  httpStatus?: number
  reason?: string
  checkedAt: string
}

async function checkCloudDriveAvailability(
  url: string,
  provider: string
): Promise<CloudDriveAvailability> {
  const checkedAt = new Date().toISOString()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      signal: controller.signal,
    })
    const text = await response.text().catch(() => "")
    const unavailableReason = getUnavailableReason(text, provider)

    if (unavailableReason) {
      return {
        status: "unavailable",
        httpStatus: response.status,
        reason: unavailableReason,
        checkedAt,
      }
    }

    if (!response.ok) {
      return {
        status: response.status === 404 ? "unavailable" : "unknown",
        httpStatus: response.status,
        reason: `HTTP ${response.status}`,
        checkedAt,
      }
    }

    return {
      status: "available",
      httpStatus: response.status,
      checkedAt,
    }
  } catch (error) {
    return {
      status: "unknown",
      reason: error instanceof Error ? error.message : "Availability check failed.",
      checkedAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function getUnavailableReason(text: string, provider: string) {
  const normalized = text.toLowerCase()
  const commonPatterns = [
    "分享的文件已经被取消",
    "分享已失效",
    "链接已失效",
    "文件不存在",
    "页面不存在",
    "分享不存在",
    "该分享不存在",
    "不存在或已失效",
    "已被删除",
    "违规内容",
    "被取消分享",
  ]
  const providerPatterns =
    provider === "baidu_pan"
      ? ["啊哦，你来晚了", "此链接分享内容可能因为涉及侵权"]
      : provider === "quark_pan"
        ? ["分享文件已被取消", "该分享已失效", "资源不存在"]
        : []
  const matched = [...commonPatterns, ...providerPatterns].find((pattern) =>
    normalized.includes(pattern.toLowerCase())
  )

  return matched
}
