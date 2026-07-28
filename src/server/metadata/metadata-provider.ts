import type { NormalizedResourceMetadata } from "@/domain/resources/metadata"
import type { ResourceType } from "@/domain/resources/types"
import { cloudDriveMetadataProvider } from "./providers/cloud-drive"
import { httpPageMetadataProvider } from "./providers/http-page"
import { localLinkMetadataProvider } from "./providers/local-link"
import { magnetMetadataProvider } from "./providers/magnet"
import { placeholderMetadataProvider } from "./providers/placeholder"
import { twitterMetadataProvider } from "./providers/twitter"

export type MetadataProviderResource = {
  id: string
  type: ResourceType
  title: string
  description?: string
  url: string
}

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
  supports(resource: Pick<MetadataProviderResource, "type" | "url">): boolean
  resolve(
    resource: MetadataProviderResource,
    options?: MetadataResolveOptions
  ): Promise<MetadataResult>
}

export class RetryableMetadataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RetryableMetadataError"
  }
}

export function isRetryableMetadataError(error: unknown) {
  return error instanceof RetryableMetadataError
}

const metadataProviders: MetadataProvider[] = [
  magnetMetadataProvider,
  twitterMetadataProvider,
  cloudDriveMetadataProvider,
  httpPageMetadataProvider,
  localLinkMetadataProvider,
  placeholderMetadataProvider,
]

export function getMetadataProvider(resource: Pick<MetadataProviderResource, "type" | "url">) {
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
