const ALLOWED_HOSTS = ["biliapi.net", "bilibili.com", "bilivideo.com", "douyin.com", "douyinvod.com", "tiktokcdn.com", "tiktokv.com", "zjcdn.com"]

export function createSocialVideoMediaProxyUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== "https:" || url.username || url.password || url.port) return value
    if (!ALLOWED_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return value
    return `/api/v1/social-video/media?url=${encodeURIComponent(value)}`
  } catch {
    return value
  }
}
