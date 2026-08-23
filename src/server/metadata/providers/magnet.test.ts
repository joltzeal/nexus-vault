import assert from "node:assert/strict"
import test from "node:test"

import { RetryableMetadataError } from "../metadata-provider"
import { magnetMetadataProvider } from "./magnet"

const resource = {
  id: "magnet-resource",
  type: "magnet" as const,
  title: "名称未知",
  description: "",
  url: "magnet:?xt=urn:btih:A70D99267B66B600B6469DFC8884034EF8CAD98C",
}

test("magnet provider merges WhatsLink metadata with the Darklyn file tree", async (t) => {
  t.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://whatslink.info/api/v1/link")) {
      return jsonResponse({
        name: "Demo",
        size: 60,
        count: 4,
        file_type: "video",
        screenshots: ["https://example.com/preview.jpg"],
      })
    }
    if (url === "https://magnet-metadata-api.darklyn.org/api/v1/metadata") {
      assert.deepEqual(JSON.parse(String(init?.body)), { magnet_uri: resource.url })
      return jsonResponse({
        info_hash: "A70D99267B66B600B6469DFC8884034EF8CAD98C",
        name: "Demo",
        size: 60,
        files: [
          { path: "cover.jpg", size: 5, offset: 0 },
          { path: "media/movie.mp4", size: 30, offset: 5 },
          { path: "media/sound.flac", size: 20, offset: 35 },
          { path: "README.txt", size: 5, offset: 55 },
        ],
        created_at: "2026-08-09T12:00:00.000Z",
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  const result = await magnetMetadataProvider.resolve(resource)

  assert.equal(result.status, "completed")
  assert.equal(result.provider, "darklyn")
  assert.equal(result.data.title, "Demo")
  assert.equal(result.data.fileCount, 4)
  assert.equal(result.data.size, 60)
  assert.equal(result.data.tree[0]?.type, "image")
  assert.equal(result.data.tree[1]?.name, "media")
  assert.equal(result.data.tree[1]?.type, "folder")
  assert.equal(result.data.tree[1]?.size, 50)
  assert.equal(result.data.tree[1]?.children?.[0]?.type, "video")
  assert.equal(result.data.tree[1]?.children?.[1]?.type, "audio")
  assert.equal(result.data.media?.[0]?.url, "https://example.com/preview.jpg")
})

test("magnet provider preserves WhatsLink metadata when Darklyn is invalid", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://whatslink.info/api/v1/link")) {
      return jsonResponse({ name: "Demo", count: 2 })
    }
    return jsonResponse({ name: "Demo" })
  })

  const result = await magnetMetadataProvider.resolve(resource)
  const magnetMetadata = result.data.extra?.magnetMetadata as
    | { error?: string }
    | undefined

  assert.equal(result.status, "completed")
  assert.equal(result.provider, "whatslink")
  assert.deepEqual(result.data.tree, [])
  assert.match(magnetMetadata?.error ?? "", /invalid file tree/i)
})

test("magnet provider retries transient Darklyn failures", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://whatslink.info/api/v1/link")) {
      return jsonResponse({ name: "Demo" })
    }
    return jsonResponse({ message: "temporarily unavailable" }, 503)
  })

  await assert.rejects(
    magnetMetadataProvider.resolve(resource, { retryTransient: true }),
    RetryableMetadataError,
  )
})

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}
