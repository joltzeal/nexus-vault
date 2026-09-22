import assert from "node:assert/strict"
import test from "node:test"

import {
  createMediaProxyUrl,
  isPublicMediaObjectKey,
} from "./media-storage"

test("WeChat MP object-storage images are publicly readable through the media proxy", () => {
  const key = "wechat-mp/resource-123/picture0.jpg"

  assert.equal(isPublicMediaObjectKey(key), true)
  assert.equal(
    createMediaProxyUrl(key),
    "/api/v1/media/wechat-mp/resource-123/picture0.jpg",
  )
})

test("similar but unrelated object prefixes remain private", () => {
  assert.equal(isPublicMediaObjectKey("wechat/resource-123/picture0.jpg"), false)
  assert.equal(isPublicMediaObjectKey("wechat-mp-private/resource-123/picture0.jpg"), false)
})
