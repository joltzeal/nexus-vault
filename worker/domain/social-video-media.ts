const SOCIAL_VIDEO_MEDIA_HOST_SUFFIXES = [
  "aweme.snssdk.com",
  "biliapi.net",
  "bilibili.com",
  "bilivideo.com",
  "bytecdn.cn",
  "byteoversea.com",
  "douyin.com",
  "douyinpic.com",
  "douyinstatic.com",
  "douyinvod.com",
  "hdslb.com",
  "muscdn.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "zjcdn.com",
] as const

export function isAllowedSocialVideoMediaUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false
    const host = url.hostname.toLowerCase()
    return SOCIAL_VIDEO_MEDIA_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    )
  } catch {
    return false
  }
}

export function createSocialVideoMediaProxyUrl(url: string) {
  if (!isAllowedSocialVideoMediaUrl(url)) return url
  return `/api/v1/social-video/media?url=${encodeURIComponent(url)}`
}
