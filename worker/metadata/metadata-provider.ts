import type { NormalizedResourceMetadata } from "../domain/resources/metadata"
import type { ResourceType } from "../domain/resources/types"
import { cloudDriveMetadataProvider } from "./providers/cloud-drive"
import { douyinMetadataProvider } from "./providers/douyin"
import { douyinTiktokDownloadApiMetadataProvider } from "./providers/douyin-tiktok-download-api"
import { httpPageMetadataProvider } from "./providers/http-page"
import { githubMetadataProvider } from "./providers/github"
import { localLinkMetadataProvider } from "./providers/local-link"
import { magnetMetadataProvider } from "./providers/magnet"
import { placeholderMetadataProvider } from "./providers/placeholder"
import { snapdouyinMetadataProvider } from "./providers/snapdouyin"
import { xunleiMetadataProvider } from "./providers/xunlei"
import { telegramMetadataProvider } from "./providers/telegram"
import { twitterMetadataProvider } from "./providers/twitter"
import { wechatMpMetadataProvider } from "./providers/wechat-mp"

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
  retryTransient?: boolean
  twitterCookieString?: string
  githubToken?: string
  tikhubApiToken?: string
  telegramMetadataApiUrl?: string
  telegramMetadataApiToken?: string
  persistTelegramMedia?: (input: {
    resourceId: string
    url: string
    mediaType: string
    contentType?: string
    fileName?: string
    sourceId?: string
  }) => Promise<string | undefined>
  persistMagnetScreenshot?: (input: {
    url: string
    sourceId: string
  }) => Promise<string | undefined>
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
  douyinTiktokDownloadApiMetadataProvider,
  magnetMetadataProvider,
  twitterMetadataProvider,
  telegramMetadataProvider,
  wechatMpMetadataProvider,
  githubMetadataProvider,
  xunleiMetadataProvider,
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
  douyinTiktokDownloadApiMetadataProvider,
  douyinMetadataProvider,
  githubMetadataProvider,
  httpPageMetadataProvider,
  localLinkMetadataProvider,
  magnetMetadataProvider,
  placeholderMetadataProvider,
  snapdouyinMetadataProvider,
  telegramMetadataProvider,
  twitterMetadataProvider,
  wechatMpMetadataProvider,
  xunleiMetadataProvider,
}
