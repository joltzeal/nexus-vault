import { AwsClient } from "aws4fetch"

import { ApiError } from "../lib/errors"

type S3MultipartEnv = Pick<
  CloudflareEnv,
  | "S3_UPLOAD_ACCESS_KEY_ID"
  | "S3_UPLOAD_BUCKET"
  | "S3_UPLOAD_ENDPOINT"
  | "S3_UPLOAD_FORCE_PATH_STYLE"
  | "S3_UPLOAD_REGION"
  | "S3_UPLOAD_SECRET_ACCESS_KEY"
>

export async function createS3MultipartUpload(
  env: S3MultipartEnv,
  input: {
    contentType: string
    customMetadata: Record<string, string>
    key: string
  },
) {
  const url = getS3ObjectUrl(env, input.key)
  url.searchParams.set("uploads", "")
  const headers = new Headers({
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": input.contentType,
  })
  for (const [name, value] of Object.entries(input.customMetadata)) {
    headers.set(`x-amz-meta-${name}`, value)
  }

  const response = await getS3Client(env).fetch(url, { method: "POST", headers })
  const body = await response.text()
  assertS3Response(response, body, "创建 multipart upload 失败。")
  const uploadId = getXmlTag(body, "UploadId")
  if (!uploadId) throw new ApiError("UPLOAD_ERROR", "S3 未返回 uploadId。", 502)
  return { key: input.key, uploadId }
}

export async function signS3MultipartPart(
  env: S3MultipartEnv,
  input: { key: string; partNumber: number; uploadId: string },
) {
  const url = getS3ObjectUrl(env, input.key)
  url.searchParams.set("partNumber", String(input.partNumber))
  url.searchParams.set("uploadId", input.uploadId)
  url.searchParams.set("X-Amz-Expires", "900")
  const request = await getS3Client(env).sign(url, {
    method: "PUT",
    aws: { signQuery: true },
  })
  return { method: "PUT" as const, url: request.url }
}

export async function completeS3MultipartUpload(
  env: S3MultipartEnv,
  input: {
    key: string
    parts: Array<{ ETag: string; PartNumber: number }>
    uploadId: string
  },
) {
  const url = getS3ObjectUrl(env, input.key)
  url.searchParams.set("uploadId", input.uploadId)
  const body = [
    "<CompleteMultipartUpload>",
    ...input.parts.map(
      (part) =>
        `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${escapeXml(part.ETag)}</ETag></Part>`,
    ),
    "</CompleteMultipartUpload>",
  ].join("")
  const response = await getS3Client(env).fetch(url, {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body,
  })
  const responseBody = await response.text()
  assertS3Response(response, responseBody, "完成 multipart upload 失败。")
}

export async function abortS3MultipartUpload(
  env: S3MultipartEnv,
  input: { key: string; uploadId: string },
) {
  const url = getS3ObjectUrl(env, input.key)
  url.searchParams.set("uploadId", input.uploadId)
  const response = await getS3Client(env).fetch(url, { method: "DELETE" })
  if (response.ok || response.status === 404) return
  const body = await response.text()
  assertS3Response(response, body, "取消 multipart upload 失败。")
}

export async function headS3Object(env: S3MultipartEnv, key: string) {
  const response = await getS3Client(env).fetch(getS3ObjectUrl(env, key), {
    method: "HEAD",
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const body = await response.text()
    assertS3Response(response, body, "读取 S3 对象失败。")
  }

  const size = Number(response.headers.get("content-length"))
  const customMetadata: Record<string, string> = {}
  for (const [name, value] of response.headers.entries()) {
    const normalizedName = name.toLowerCase()
    if (normalizedName.startsWith("x-amz-meta-")) {
      customMetadata[normalizedName.slice("x-amz-meta-".length)] = value
    }
  }

  return {
    customMetadata,
    httpMetadata: {
      contentType: response.headers.get("content-type") ?? undefined,
    },
    key,
    size: Number.isFinite(size) ? size : 0,
  }
}

function getS3Client(env: S3MultipartEnv) {
  const accessKeyId = requireS3Config(env.S3_UPLOAD_ACCESS_KEY_ID, "S3_UPLOAD_ACCESS_KEY_ID")
  const secretAccessKey = requireS3Config(
    env.S3_UPLOAD_SECRET_ACCESS_KEY,
    "S3_UPLOAD_SECRET_ACCESS_KEY",
  )
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: requireS3Config(env.S3_UPLOAD_REGION, "S3_UPLOAD_REGION"),
    service: "s3",
  })
}

function getS3ObjectUrl(env: S3MultipartEnv, key: string) {
  const endpoint = new URL(requireS3Config(env.S3_UPLOAD_ENDPOINT, "S3_UPLOAD_ENDPOINT"))
  const bucket = requireS3Config(env.S3_UPLOAD_BUCKET, "S3_UPLOAD_BUCKET")
  const encodedKey = key.split("/").map(encodeURIComponent).join("/")
  const forcePathStyle = env.S3_UPLOAD_FORCE_PATH_STYLE?.trim().toLowerCase() === "true"

  if (forcePathStyle) {
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${encodedKey}`
  } else {
    endpoint.hostname = `${bucket}.${endpoint.hostname}`
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/${encodedKey}`
  }
  return endpoint
}

function requireS3Config(value: string | undefined, name: string) {
  const normalized = value?.trim()
  if (!normalized) {
    throw new ApiError("CONFIGURATION_ERROR", `${name} 未配置。`, 503)
  }
  return normalized
}

function assertS3Response(response: Response, body: string, message: string) {
  if (response.ok) return
  const detail = getXmlTag(body, "Message")
  throw new ApiError(
    "UPLOAD_ERROR",
    detail ? `${message} ${detail}` : message,
    response.status >= 400 && response.status < 500 ? 422 : 502,
  )
}

function getXmlTag(xml: string, tag: string) {
  const value = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1]
  return value ? decodeXml(value.trim()) : undefined
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
