import { createBaseResourceMetadata } from "@/domain/resources/metadata"

import type { MetadataProvider } from "../metadata-provider"

export const placeholderMetadataProvider: MetadataProvider = {
  name: "placeholder",
  supports: () => true,
  async resolve(resource) {
    return {
      provider: resource.type,
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: resource.type,
          title: resource.title,
        }),
        title: resource.title,
        source: {
          name: "placeholder",
        },
        extra: {
          url: resource.url,
          placeholder: true,
        },
      },
    }
  },
}
