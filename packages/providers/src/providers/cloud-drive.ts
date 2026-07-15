import { createBaseResourceMetadata } from "@nexus-vault/shared/resource-metadata"
import {
  getCloudDriveProviderLabel,
  isCloudDriveLink,
  isCloudDriveResourceType,
  parseCloudDriveLink,
} from "@nexus-vault/shared/resource-input"

import type { MetadataProvider } from "../metadata-provider"

export const cloudDriveMetadataProvider: MetadataProvider = {
  name: "cloud-drive-link-parser",
  supports: (resource) => isCloudDriveResourceType(resource.type) || isCloudDriveLink(resource.url),
  async resolve(resource) {
    const parsed = parseCloudDriveLink(resource.url)
    const provider =
      parsed?.provider ?? (isCloudDriveResourceType(resource.type) ? resource.type : "baidu_pan")
    const title = `${getCloudDriveProviderLabel(provider)}链接`

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
            availability: {
              status: "unknown",
              reason: "Cloud drive links are not probed by metadata providers.",
              checkedAt: new Date().toISOString(),
            },
          },
        },
      },
    }
  },
}
