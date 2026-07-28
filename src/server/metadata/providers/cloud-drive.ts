import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import {
  getCloudDriveProviderLabel,
  isCloudDriveLink,
  isCloudDriveResourceType,
  parseCloudDriveLink,
} from "@/domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

type CloudDriveAvailabilityStatus =
  | "available"
  | "unavailable"
  | "password_required"
  | "rate_limited"
  | "unknown"

type CloudDriveAvailability = {
  status: CloudDriveAvailabilityStatus
  reason: string
  checkedAt: string
  httpStatus?: number
  errno?: number
}

type BaiduShareListResponse = {
  errno?: number
  errmsg?: string
  err_msg?: string
  title?: string
}

type BaiduVerifyResponse = {
  errno?: number
  errmsg?: string
  err_msg?: string
  randsk?: string
}

export const cloudDriveMetadataProvider: MetadataProvider = {
  name: "cloud-drive-link-parser",
  supports: (resource) => isCloudDriveResourceType(resource.type) || isCloudDriveLink(resource.url),
  async resolve(resource, options) {
    const parsed = parseCloudDriveLink(resource.url)
    const provider =
      parsed?.provider ?? (isCloudDriveResourceType(resource.type) ? resource.type : "baidu_pan")
    const title = `${getCloudDriveProviderLabel(provider)}链接`
    const availability =
      options?.probeCloudDriveAvailability !== false && parsed?.provider === "baidu_pan"
        ? await checkBaiduPanAvailability(parsed.url, parsed.shareId, parsed.password)
        : createUnknownAvailability("Cloud drive links are not probed by metadata providers.")

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

async function checkBaiduPanAvailability(
  url: string,
  shareId: string | undefined,
  password: string | undefined
): Promise<CloudDriveAvailability> {
  if (!shareId) {
    return createAvailability("unavailable", "百度网盘分享 ID 无效。")
  }

  const shorturl = getBaiduShorturl(shareId)
  let bdclnd = ""

  try {
    if (password?.trim()) {
      const verifyResult = await verifyBaiduPassCode(url, shorturl, password.trim())
      if (verifyResult.availability) return verifyResult.availability
      bdclnd = verifyResult.bdclnd
    }

    const result = await callBaiduShareList(url, shorturl, bdclnd)
    return toBaiduAvailability(result.errno, result.errmsg ?? result.err_msg, result.httpStatus)
  } catch (error) {
    return createAvailability(
      "unknown",
      error instanceof Error ? error.message : "百度网盘检测请求失败。"
    )
  }
}

async function verifyBaiduPassCode(
  refererUrl: string,
  shorturl: string,
  password: string
): Promise<{ bdclnd: string; availability?: CloudDriveAvailability }> {
  const verifyUrl = new URL("https://pan.baidu.com/share/verify")
  verifyUrl.searchParams.set("surl", shorturl)
  verifyUrl.searchParams.set("pwd", password)

  const body = new URLSearchParams({
    pwd: password,
    vcode: "",
    vcode_str: "",
  })

  const response = await fetch(verifyUrl.toString(), {
    method: "POST",
    headers: {
      ...getBaiduRequestHeaders(),
      "content-type": "application/x-www-form-urlencoded",
      referer: refererUrl,
    },
    body,
    signal: AbortSignal.timeout(10000),
  })
  const result = await parseJsonResponse<BaiduVerifyResponse>(response)
  const errno = result.data.errno

  if (errno === 0 && result.data.randsk) {
    return { bdclnd: result.data.randsk }
  }

  if (errno === 0) {
    return {
      bdclnd: "",
      availability: createAvailability(
        "unknown",
        "百度网盘提取码验证成功，但没有返回访问凭据。",
        result.httpStatus,
        errno
      ),
    }
  }

  return {
    bdclnd: "",
    availability: toBaiduAvailability(
      errno,
      result.data.errmsg ?? result.data.err_msg ?? "提取码验证失败。",
      result.httpStatus
    ),
  }
}

async function callBaiduShareList(
  refererUrl: string,
  shorturl: string,
  bdclnd: string
): Promise<BaiduShareListResponse & { httpStatus: number }> {
  const apiUrl = new URL("https://pan.baidu.com/share/list")
  apiUrl.searchParams.set("web", "1")
  apiUrl.searchParams.set("app_id", "250528")
  apiUrl.searchParams.set("desc", "1")
  apiUrl.searchParams.set("showempty", "0")
  apiUrl.searchParams.set("page", "1")
  apiUrl.searchParams.set("num", "20")
  apiUrl.searchParams.set("order", "time")
  apiUrl.searchParams.set("shorturl", shorturl)
  apiUrl.searchParams.set("root", "1")
  apiUrl.searchParams.set("view_mode", "1")
  apiUrl.searchParams.set("channel", "chunlei")
  apiUrl.searchParams.set("clienttype", "0")

  const headers = getBaiduRequestHeaders()
  headers.referer = refererUrl
  if (bdclnd) headers.cookie = `BDCLND=${bdclnd}`

  const response = await fetch(apiUrl.toString(), {
    headers,
    signal: AbortSignal.timeout(10000),
  })
  const result = await parseJsonResponse<BaiduShareListResponse>(response)

  return {
    ...result.data,
    httpStatus: result.httpStatus,
  }
}

async function parseJsonResponse<T>(response: Response): Promise<{ data: T; httpStatus: number }> {
  const text = await response.text()

  try {
    return {
      data: JSON.parse(text) as T,
      httpStatus: response.status,
    }
  } catch {
    throw new Error(
      `百度网盘接口返回非 JSON 响应，HTTP ${response.status}。`
    )
  }
}

function toBaiduAvailability(
  errno: number | undefined,
  message: string | undefined,
  httpStatus?: number
): CloudDriveAvailability {
  if (errno === 0) {
    return createAvailability("available", "百度网盘分享链接可用。", httpStatus, errno)
  }

  if (errno === -12) {
    return createAvailability("password_required", "百度网盘分享需要提取码。", httpStatus, errno)
  }

  if (errno === -62) {
    return createAvailability("rate_limited", "百度网盘接口请求受限。", httpStatus, errno)
  }

  const reason = getBaiduFailureReason(errno, message)
  return createAvailability("unavailable", reason, httpStatus, errno)
}

function getBaiduFailureReason(errno: number | undefined, message: string | undefined) {
  if (message?.trim()) return `百度网盘分享不可用：${message.trim()}`

  if (errno === -9) return "百度网盘提取码错误。"
  if (errno === -8) return "百度网盘分享已过期。"
  if (typeof errno === "number") return `百度网盘分享不可用，错误码 ${errno}。`

  return "百度网盘分享状态未知。"
}

function createUnknownAvailability(reason: string) {
  return createAvailability("unknown", reason)
}

function createAvailability(
  status: CloudDriveAvailabilityStatus,
  reason: string,
  httpStatus?: number,
  errno?: number
): CloudDriveAvailability {
  return {
    status,
    reason,
    checkedAt: new Date().toISOString(),
    httpStatus,
    errno,
  }
}

function getBaiduShorturl(shareId: string) {
  return shareId.length > 1 ? shareId.slice(1) : shareId
}

function getBaiduRequestHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  }
}
