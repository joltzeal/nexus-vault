import { createBaseResourceMetadata } from "../../domain/resources/metadata"
import {
  getCloudDriveProviderLabel,
  parseCloudDriveLink,
} from "../../domain/resources/input"

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
  errorCode?: number
}

type XunleiShareResponse = {
  share_status?: string
  share_status_text?: string
  error_description?: string
  error_code?: number
  share_name?: string
  title?: string
  name?: string
}

const XUNLEI_CLIENT_ID = "ZUBzD9J_XPXfn7f7"
const XUNLEI_CLIENT_VERSION = "1.10.0.2633"
const XUNLEI_PACKAGE_NAME = "com.xunlei.browser"
const XUNLEI_DEVICE_ID = "5505bd0cab8c9469b98e5891d9fb3e0d"
const XUNLEI_USER_AGENT =
  "ANDROID-com.xunlei.browser/1.10.0.2633 networkType/WIFI appid/22062 deviceName/Xiaomi_M2004j7ac deviceModel/M2004J7AC OSVersion/13 protocolVersion/301 platformVersion/10 sdkVersion/233100 Oauth2Client/0.9 (Linux 4_9_337-perf-sn-uotan-gd9d488809c3d3d) (JAVA 0)"

export const xunleiMetadataProvider: MetadataProvider = {
  name: "xunlei",
  supports: (resource) =>
    resource.type === "xunlei_pan" || parseCloudDriveLink(resource.url)?.provider === "xunlei_pan",
  async resolve(resource, options) {
    const parsed = parseCloudDriveLink(resource.url)

    if (!parsed || parsed.provider !== "xunlei_pan") {
      return {
        provider: "xunlei",
        status: "failed",
        data: createBaseResourceMetadata({
          type: resource.type,
          title: resource.title,
        }),
        errorMessage: "Invalid Xunlei cloud drive URL.",
      }
    }

    const title = resource.title || `${getCloudDriveProviderLabel("xunlei_pan")}链接`
    const availability =
      options?.probeCloudDriveAvailability === false
        ? createUnknownAvailability("迅雷云盘链接未进行可用性检测。")
        : await checkXunleiPanAvailability(parsed.shareId, parsed.password)

    return {
      provider: "xunlei",
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: resource.type,
          title,
        }),
        title,
        source: {
          name: "xunlei",
          url: parsed.url,
        },
        extra: {
          cloudDrive: {
            provider: "xunlei_pan",
            host: parsed.host,
            url: parsed.url,
            password: parsed.password,
            shareId: parsed.shareId,
            availability,
          },
        },
      },
    }
  },
}

async function checkXunleiPanAvailability(
  shareId: string | undefined,
  password: string | undefined
): Promise<CloudDriveAvailability> {
  if (!shareId) {
    return createAvailability("unavailable", "迅雷云盘分享 ID 无效。")
  }

  const captchaToken = await getCaptchaToken("get:/drive/v1/share").catch(() => "")
  const apiUrl = new URL("https://api-pan.xunlei.com/drive/v1/share")
  apiUrl.searchParams.set("share_id", shareId)
  apiUrl.searchParams.set("pass_code", password?.trim() ?? "")
  apiUrl.searchParams.set("pass_code_token", "")
  apiUrl.searchParams.set("page_token", "")
  apiUrl.searchParams.set("limit", "100")
  apiUrl.searchParams.set("thumbnail_size", "SIZE_SMALL")

  const headers = new Headers({
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://pan.xunlei.com",
    referer: "https://pan.xunlei.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-client-id": XUNLEI_CLIENT_ID,
    "x-device-id": XUNLEI_DEVICE_ID,
  })
  if (captchaToken) headers.set("x-captcha-token", captchaToken)

  try {
    const response = await fetch(apiUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    const result = await parseJsonResponse<XunleiShareResponse>(response)

    if (result.httpStatus !== 200) {
      if (result.httpStatus === 429 || result.data.error_code === 9) {
        return createAvailability(
          "rate_limited",
          "迅雷云盘接口请求受限。",
          result.httpStatus,
          result.data.error_code
        )
      }

      return createAvailability(
        "unavailable",
        getXunleiFailureReason(result.data, result.httpStatus),
        result.httpStatus,
        result.data.error_code
      )
    }

    if (normalizeString(result.data.share_status) === "OK") {
      return createAvailability("available", "迅雷云盘分享链接可用。", result.httpStatus)
    }

    const statusText =
      normalizeString(result.data.share_status_text) ||
      normalizeString(result.data.error_description) ||
      `分享状态: ${normalizeString(result.data.share_status) || "unknown"}`
    const isPasswordProtected = isPasswordRequired(result.data)

    return createAvailability(
      isPasswordProtected ? "password_required" : "unavailable",
      statusText,
      result.httpStatus,
      result.data.error_code
    )
  } catch (error) {
    return createAvailability(
      "unknown",
      error instanceof Error ? error.message : "迅雷云盘检测请求失败。"
    )
  }
}

async function getCaptchaToken(action: string) {
  const timestamp = String(Date.now())
  const sign = await getCaptchaSign(timestamp)
  const body = {
    action,
    captcha_token: "",
    client_id: XUNLEI_CLIENT_ID,
    device_id: XUNLEI_DEVICE_ID,
    meta: {
      timestamp,
      captcha_sign: sign,
      client_version: XUNLEI_CLIENT_VERSION,
      package_name: XUNLEI_PACKAGE_NAME,
    },
    redirect_uri: "xlaccsdk01://xunlei.com/callback?state=harbor",
  }

  const response = await fetch("https://xluser-ssl.xunlei.com/v1/shield/captcha/init", {
    method: "POST",
    headers: {
      accept: "application/json;charset=UTF-8",
      "content-type": "application/json",
      "user-agent": XUNLEI_USER_AGENT,
      "x-client-id": XUNLEI_CLIENT_ID,
      "x-client-version": XUNLEI_CLIENT_VERSION,
      "x-device-id": XUNLEI_DEVICE_ID,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) return ""

  const parsed = (await response.json()) as { captcha_token?: string; url?: string }
  if (parsed.url) return ""
  return normalizeString(parsed.captcha_token)
}

async function getCaptchaSign(timestamp: string) {
  const parts = [
    XUNLEI_CLIENT_ID,
    XUNLEI_CLIENT_VERSION,
    XUNLEI_PACKAGE_NAME,
    XUNLEI_DEVICE_ID,
    timestamp,
  ]
  const algorithms = [
    "uWRwO7gPfdPB/0NfPtfQO+71",
    "F93x+qPluYy6jdgNpq+lwdH1ap6WOM+nfz8/V",
    "0HbpxvpXFsBK5CoTKam",
    "dQhzbhzFRcawnsZqRETT9AuPAJ+wTQso82mRv",
    "SAH98AmLZLRa6DB2u68sGhyiDh15guJpXhBzI",
    "unqfo7Z64Rie9RNHMOB",
    "7yxUdFADp3DOBvXdz0DPuKNVT35wqa5z0DEyEvf",
    "RBG",
    "ThTWPG5eC0UBqlbQ+04nZAptqGCdpv9o55A",
  ]

  let current = parts.join("")
  for (const algorithm of algorithms) {
    current = await md5Hex(`${current}${algorithm}`)
  }

  return `1.${current}`
}

async function md5Hex(value: string) {
  const hash = new Md5Js()
  hash.update(value)
  const digest = await hash.digest()
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function parseJsonResponse<T>(response: Response): Promise<{ data: T; httpStatus: number }> {
  const text = await response.text()

  try {
    return {
      data: JSON.parse(text) as T,
      httpStatus: response.status,
    }
  } catch {
    throw new Error(`迅雷云盘接口返回非 JSON 响应，HTTP ${response.status}。`)
  }
}

function isPasswordRequired(value: XunleiShareResponse) {
  const errorDescription = normalizeString(value.error_description)
  const statusText = normalizeString(value.share_status_text)
  return Boolean(
    errorDescription &&
      (errorDescription.includes("提取码") || errorDescription.includes("pass_code")) ||
      statusText && (statusText.includes("提取码") || statusText.includes("pass_code"))
  )
}

function getXunleiFailureReason(value: XunleiShareResponse, httpStatus?: number) {
  const message =
    normalizeString(value.error_description) ||
    normalizeString(value.share_status_text) ||
    normalizeString(value.share_name) ||
    normalizeString(value.title) ||
    normalizeString(value.name)
  if (message) return `迅雷云盘分享不可用：${message}`
  if (typeof value.error_code === "number") {
    return `迅雷云盘分享不可用，错误码 ${value.error_code}${httpStatus ? `，HTTP ${httpStatus}` : ""}。`
  }
  return httpStatus ? `迅雷云盘分享不可用，HTTP ${httpStatus}。` : "迅雷云盘分享状态未知。"
}

function createUnknownAvailability(reason: string) {
  return createAvailability("unknown", reason)
}

function createAvailability(
  status: CloudDriveAvailabilityStatus,
  reason: string,
  httpStatus?: number,
  errorCode?: number
): CloudDriveAvailability {
  return {
    status,
    reason,
    checkedAt: new Date().toISOString(),
    httpStatus,
    errorCode,
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

class Md5Js {
  digestLength = 16
  state = Uint32Array.from(INIT)
  writeBuffer = new DataView(new ArrayBuffer(64))
  bufferLength = 0
  bytesHashed = 0

  update(sourceData: string) {
    const data = new TextEncoder().encode(sourceData)
    let pos = 0
    let len = data.byteLength
    this.bytesHashed += len

    while (len > 0) {
      this.writeBuffer.setUint8(this.bufferLength++, data[pos++])
      --len
      if (this.bufferLength === 64) {
        compress(this.state, this.writeBuffer)
        this.bufferLength = 0
      }
    }
  }

  async digest() {
    const state = Uint32Array.from(this.state)
    const buf = new DataView(this.writeBuffer.buffer.slice(0))
    let bufLen = this.bufferLength
    const bits = this.bytesHashed * 8

    buf.setUint8(bufLen++, 0x80)
    if (this.bufferLength % 64 >= 56) {
      for (let index = bufLen; index < 64; ++index) {
        buf.setUint8(index, 0)
      }
      compress(state, buf)
      bufLen = 0
    }

    for (let index = bufLen; index < 56; ++index) {
      buf.setUint8(index, 0)
    }
    buf.setUint32(56, bits >>> 0, true)
    buf.setUint32(60, Math.floor(bits / 2 ** 32), true)
    compress(state, buf)

    const out = new Uint8Array(16)
    const view = new DataView(out.buffer)
    for (let index = 0; index < 4; ++index) {
      view.setUint32(index * 4, state[index], true)
    }
    return out
  }
}

const INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]
const M = 0xffffffff
const S = Uint8Array.of(7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21)
const T = Array.from({ length: 64 }, (_, index) => (Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0)

function compress(state: Uint32Array, block: DataView) {
  let a = state[0]
  let b = state[1]
  let c = state[2]
  let d = state[3]

  for (let index = 0; index < 64; ++index) {
    let f: number
    let g: number
    if (index < 16) {
      f = (b & c) | (~b & d)
      g = index
    } else if (index < 32) {
      f = (d & b) | (c & ~d)
      g = (5 * index + 1) % 16
    } else if (index < 48) {
      f = b ^ c ^ d
      g = (3 * index + 5) % 16
    } else {
      f = c ^ (b | ~d)
      g = (7 * index) % 16
    }

    const x = block.getUint32(g * 4, true)
    const tmp = d
    d = c
    c = b
    const shift = S[(index >> 4) * 4 + (index & 3)]
    const sum = (((a + f) & M) + ((x + T[index]) & M)) & M
    b = (b + (((sum << shift) | (sum >>> (32 - shift))) >>> 0)) & M
    a = tmp
  }

  state[0] = (state[0] + a) & M
  state[1] = (state[1] + b) & M
  state[2] = (state[2] + c) & M
  state[3] = (state[3] + d) & M
}
