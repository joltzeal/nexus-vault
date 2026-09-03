export type CloudDriveProvider =
  | "baidu_pan"
  | "pan_115"
  | "pan_123"
  | "quark_pan"
  | "uc_pan"
  | "xunlei_pan"
  | "pikpak"

export type ParsedCloudDriveLink = {
  host: string
  password?: string
  provider: CloudDriveProvider
  shareId?: string
}

const cloudDriveConfigs: Array<{
  label: string
  matchesHost: (host: string) => boolean
  passwordParam: "password" | "passcode" | "pwd"
  provider: CloudDriveProvider
}> = [
  { label: "百度网盘", matchesHost: (host) => host === "pan.baidu.com", passwordParam: "pwd", provider: "baidu_pan" },
  { label: "115 盘", matchesHost: (host) => host === "115cdn.com", passwordParam: "password", provider: "pan_115" },
  { label: "123 云盘", matchesHost: (host) => /^123\d{3}\.com$/.test(host), passwordParam: "pwd", provider: "pan_123" },
  { label: "夸克网盘", matchesHost: (host) => host === "pan.quark.cn", passwordParam: "passcode", provider: "quark_pan" },
  { label: "UC 网盘", matchesHost: (host) => host === "drive.uc.cn", passwordParam: "passcode", provider: "uc_pan" },
  { label: "迅雷网盘", matchesHost: (host) => host === "pan.xunlei.com", passwordParam: "pwd", provider: "xunlei_pan" },
  { label: "PikPak", matchesHost: (host) => host === "mypikpak.com", passwordParam: "passcode", provider: "pikpak" },
]

export function parseCloudDriveLink(url: string, extractionCode?: string): ParsedCloudDriveLink | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  const config = cloudDriveConfigs.find((item) => item.matchesHost(host))
  if (!config) return null

  const password =
    extractionCode?.trim() ||
    parsed.searchParams.get("pwd")?.trim() ||
    parsed.searchParams.get("password")?.trim() ||
    parsed.searchParams.get("passcode")?.trim() ||
    undefined
  const segments = parsed.pathname.split("/").filter(Boolean)
  const shareIndex = segments.findIndex((segment) => ["s", "share"].includes(segment.toLowerCase()))

  return {
    host,
    password,
    provider: config.provider,
    ...(shareIndex >= 0 && segments[shareIndex + 1] ? { shareId: segments[shareIndex + 1] } : {}),
  }
}

export function getCloudDriveProviderLabel(provider: CloudDriveProvider) {
  return cloudDriveConfigs.find((item) => item.provider === provider)?.label ?? "网盘"
}

export function isCloudDriveResourceType(value: string): value is CloudDriveProvider {
  return cloudDriveConfigs.some((item) => item.provider === value)
}
