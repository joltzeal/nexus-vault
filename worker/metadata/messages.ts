import { isCloudDriveResourceType, parseCloudDriveLink, parseDouyinLink, parseGofileLink, parseMagnetLink, parseTelegramMessageLink, parseTwitterLink, parseWechatMpArticleLink, type ResourceType } from "../domain/resources/input"

export type MetadataQueueMessage = {
  kind: "metadata.resolve"
  resourceId: string
  vaultId: string | null
  type: ResourceType
  dedupeKey?: string
  requestedAt: string
}

export function createMetadataQueueMessage(
  vaultId: string | null,
  resourceId: string,
  type: ResourceType,
  url: string
): MetadataQueueMessage {
  const parsedMagnet = type === "magnet" ? parseMagnetLink(url) : null
  const parsedTwitter = type === "twitter" ? parseTwitterLink(url) : null
  const parsedTelegram = type === "telegram" ? parseTelegramMessageLink(url) : null
  const parsedDouyin = type === "douyin" ? parseDouyinLink(url) : null
  const parsedWechatMp = type === "wechat_mp" ? parseWechatMpArticleLink(url) : null
  const parsedCloudDrive = isCloudDriveResourceType(type) ? parseCloudDriveLink(url) : null
  const parsedGofile = type === "gofile" ? parseGofileLink(url) : null

  return {
    kind: "metadata.resolve",
    vaultId,
    resourceId,
    type,
    dedupeKey: parsedMagnet
      ? `magnet:${parsedMagnet.infoHash}`
      : parsedTwitter
        ? `twitter:${parsedTwitter.tweetId}`
        : parsedTelegram
          ? `telegram:${parsedTelegram.chatUsername ?? parsedTelegram.internalChatId}:${parsedTelegram.messageId}`
          : parsedDouyin
            ? `douyin:${parsedDouyin.videoId ?? parsedDouyin.shareCode ?? parsedDouyin.url}`
            : parsedWechatMp
              ? `wechat_mp:${parsedWechatMp.articleToken ?? `${parsedWechatMp.biz}:${parsedWechatMp.mid}:${parsedWechatMp.idx}:${parsedWechatMp.sn}`}`
              : parsedCloudDrive
                ? `${parsedCloudDrive.provider}:${parsedCloudDrive.url}`
                : parsedGofile
                  ? `gofile:${parsedGofile.contentId}`
                  : undefined,
    requestedAt: new Date().toISOString(),
  }
}
