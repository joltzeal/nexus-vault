import type { resources } from "@nexus-vault/db/schema"
import type { NormalizedResourceMetadata } from "@nexus-vault/shared/resource-metadata"

import { cloudDriveMetadataProvider } from "./providers/cloud-drive"
import { httpPageMetadataProvider } from "./providers/http-page"
import { localLinkMetadataProvider } from "./providers/local-link"
import { magnetMetadataProvider } from "./providers/magnet"
import { placeholderMetadataProvider } from "./providers/placeholder"
import { twitterMetadataProvider } from "./providers/twitter"

type ResourceInput = typeof resources.$inferSelect

export type MetadataResult = {
  provider: string
  status: "pending" | "processing" | "completed" | "failed"
  data: NormalizedResourceMetadata
  errorMessage?: string
}

export type MetadataResolveOptions = {
  fetchHttpPage?: boolean
  probeCloudDriveAvailability?: boolean
  twitterRequestProxyUrl?: string
  twitterCookieString?: string
  captureHttpScreenshot?: (input: {
    resourceId: string
    title: string
    url: string
  }) => Promise<string | undefined>
}

export interface MetadataProvider {
  name: string
  supports(resource: Pick<ResourceInput, "type" | "url">): boolean
  resolve(resource: ResourceInput, options?: MetadataResolveOptions): Promise<MetadataResult>
}

const metadataProviders: MetadataProvider[] = [
  magnetMetadataProvider,
  twitterMetadataProvider,
  cloudDriveMetadataProvider,
  httpPageMetadataProvider,
  localLinkMetadataProvider,
  placeholderMetadataProvider,
]

export function getMetadataProvider(resource: Pick<ResourceInput, "type" | "url">) {
  return (
    metadataProviders.find((provider) => provider.supports(resource)) ??
    placeholderMetadataProvider
  )
}

export {
  cloudDriveMetadataProvider,
  httpPageMetadataProvider,
  localLinkMetadataProvider,
  magnetMetadataProvider,
  placeholderMetadataProvider,
  twitterMetadataProvider,
}
