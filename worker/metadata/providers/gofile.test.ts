import assert from "node:assert/strict"
import test from "node:test"

import { parseResourceInput } from "../../domain/resources/input"
import { createMetadataQueueMessage } from "../messages"
import { getMetadataProvider } from "../metadata-provider"
import { isCloudDriveCheckQueueMessage } from "../../services/cloud-drive-check-service"
import { gofileMetadataProvider } from "./gofile"

test("GoFile links are parsed and routed to the dedicated provider", () => {
  const parsed = parseResourceInput({ url: "https://www.gofile.io/d/FgRkwkPE?source=share" })

  assert.deepEqual(parsed, {
    type: "gofile",
    url: "https://gofile.io/d/FgRkwkPE",
    title: "GoFile folder",
    metadata: { contentId: "FgRkwkPE", host: "gofile.io" },
  })
  assert.equal(getMetadataProvider({ type: "http", url: parsed.url }).name, "gofile")
  assert.equal(
    createMetadataQueueMessage("vault", "resource", parsed.type, parsed.url).dedupeKey,
    "gofile:FgRkwkPE",
  )
  assert.equal(isCloudDriveCheckQueueMessage({
    kind: "cloud-drive.check",
    provider: "gofile",
    resourceId: "resource",
    vaultId: "vault",
    requestedAt: new Date().toISOString(),
  }), true)
})

test("GoFile provider recursively normalizes folders and their media", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("authorization"), "Bearer configured-token")
    assert.equal(headers.get("x-bl"), "en-US")
    assert.match(headers.get("x-website-token") ?? "", /^[a-f0-9]{64}$/)

    if (url.pathname === "/contents/FgRkwkPE") {
      return jsonResponse({
        status: "ok",
        data: {
          canAccess: true,
          id: "root-id",
          name: "Demo collection",
          type: "folder",
          children: {
            "image-id": {
              id: "image-id",
              name: "cover.jpg",
              size: 120,
              type: "file",
              mimetype: "image/jpeg",
              link: "https://file.example/cover.jpg",
              thumbnail: "https://file.example/cover-thumb.jpg",
              modTime: 200,
            },
            "folder-id": {
              id: "folder-id",
              name: "Videos",
              type: "folder",
            },
          },
        },
      })
    }
    if (url.pathname === "/contents/folder-id") {
      return jsonResponse({
        status: "ok",
        data: {
          id: "folder-id",
          name: "Videos",
          type: "folder",
          children: {
            "video-id": {
              id: "video-id",
              name: "clip.mp4",
              size: 83341773,
              type: "file",
              mimetype: "video/mp4",
              link: "https://file.example/clip.mp4",
              modTime: 100,
            },
          },
        },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  const result = await gofileMetadataProvider.resolve({
    id: "resource",
    type: "gofile",
    title: "GoFile folder",
    description: "",
    url: "https://gofile.io/d/FgRkwkPE",
  }, { gofileApiToken: "configured-token" })

  assert.equal(result.status, "completed")
  assert.equal(result.data.title, "Demo collection")
  assert.equal(result.data.fileCount, 2)
  assert.equal(result.data.size, 83341893)
  assert.equal(
    (result.data.extra?.cloudDrive as { availability?: { status?: string } })?.availability?.status,
    "available",
  )
  assert.deepEqual(result.data.media?.map((item) => item.fileName), ["clip.mp4", "cover.jpg"])
  assert.deepEqual(
    result.data.media?.map(({ fileName, kind, size, thumbnailUrl, url }) => ({
      fileName,
      kind,
      size,
      thumbnailUrl,
      url,
    })),
    [
      {
        fileName: "clip.mp4",
        kind: "video",
        size: 83341773,
        thumbnailUrl: undefined,
        url: "/api/v1/resources/resource/media/0/stream",
      },
      {
        fileName: "cover.jpg",
        kind: "image",
        size: 120,
        thumbnailUrl: "/api/v1/resources/resource/media/1/stream",
        url: "/api/v1/resources/resource/media/1/stream",
      },
    ],
  )
  assert.deepEqual(result.data.tree[0]?.children?.[1], {
    name: "Videos",
    type: "folder",
    children: [{
      name: "clip.mp4",
      type: "video",
      size: 83341773,
    }],
  })
})

test("GoFile provider accepts an API response whose root is a single file", async (t) => {
  let accountCreationCalls = 0
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    if (url.pathname === "/accounts") {
      accountCreationCalls += 1
      assert.equal(init?.method, "POST")
      return jsonResponse({ status: "ok", data: { token: "new-account-token" } })
    }
    assert.equal(url.pathname, "/contents/FgRkwkPE")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer new-account-token")
    return jsonResponse({
      status: "ok",
      data: {
        canAccess: true,
        id: "a0615b69-b278-4b08-a241-d45a927126bb",
        type: "file",
        name: "VID_20260819_233240_1.mp4",
        size: 83341773,
        mimetype: "video/mp4",
        code: "FgRkwkPE",
        link: "https://file-eu-ldn-1.gofile.io/download/web/a0615b69-b278-4b08-a241-d45a927126bb/VID_20260819_233240_1.mp4",
      },
    })
  })

  const result = await gofileMetadataProvider.resolve({
    id: "single-file-resource",
    type: "gofile",
    title: "GoFile folder",
    description: "",
    url: "https://gofile.io/d/FgRkwkPE",
  })

  assert.equal(accountCreationCalls, 1)
  assert.equal(result.status, "completed", result.errorMessage)
  assert.equal(result.data.title, "VID_20260819_233240_1.mp4")
  assert.equal(result.data.fileCount, 1)
  assert.equal(result.data.fileType, "video")
  assert.equal(result.data.media?.[0]?.kind, "video")
  assert.equal(result.data.media?.[0]?.sourceId, "a0615b69-b278-4b08-a241-d45a927126bb")
  assert.equal(
    (result.data.extra?.cloudDrive as { availability?: { status?: string } })?.availability?.status,
    "available",
  )
})

test("GoFile provider marks an empty folder unavailable", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    assert.equal(new URL(getRequestUrl(input)).pathname, "/contents/empty-folder")
    return jsonResponse({
      status: "ok",
      data: {
        canAccess: true,
        id: "empty-folder",
        name: "Empty folder",
        type: "folder",
        children: {},
      },
    })
  })

  const result = await gofileMetadataProvider.resolve({
    id: "empty-folder-resource",
    type: "gofile",
    title: "GoFile folder",
    description: "",
    url: "https://gofile.io/d/empty-folder",
  }, { gofileApiToken: "configured-token" })

  assert.equal(result.status, "completed")
  assert.equal(result.data.fileCount, 0)
  assert.equal(
    (result.data.extra?.cloudDrive as { availability?: { status?: string } })?.availability?.status,
    "unavailable",
  )
})

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  })
}
