import assert from "node:assert/strict"
import test from "node:test"

import { parseResourceInput } from "../domain/resources/input"
import { can } from "../domain/vaults/permissions"
import {
  createResourceSchema,
  transferResourcesSchema,
  updateResourceSchema,
} from "./schemas/resource"
import {
  createSpaceSchema,
  transferSpaceSchema,
  updateSpaceSchema,
} from "./schemas/space"
import { createResourceSubmissionSchema } from "./schemas/submission"
import { createVaultSchema } from "./schemas/vault"

test("space schemas accept icon values for create and update", () => {
  assert.equal(
    createSpaceSchema.parse({
      name: "Media",
      description: "Screens and streams",
      icon: "clapperboard",
    }).icon,
    "clapperboard"
  )
  assert.equal(updateSpaceSchema.parse({ icon: "database" }).icon, "database")
})

test("space transfer schema requires a target vault UUID", () => {
  assert.equal(
    transferSpaceSchema.parse({
      targetVaultId: "6805e441-b73b-4318-aa8c-bf0da42e5548",
    }).targetVaultId,
    "6805e441-b73b-4318-aa8c-bf0da42e5548",
  )
  assert.throws(() => transferSpaceSchema.parse({ targetVaultId: "not-a-vault" }))
})

test("resource transfer schema accepts multiple resources", () => {
  const input = transferResourcesSchema.parse({
    action: "move",
    resourceIds: [
      "6805e441-b73b-4318-aa8c-bf0da42e5548",
      "1a88dc2c-2c9f-447c-a5aa-00d75229ed0f",
    ],
    targetVaultId: "f9a4f3dd-4a09-42f5-9d4f-e81556767421",
    targetSpaceId: "6886d566-0be7-4ab7-b5e3-0ced26fc04e4",
  })

  assert.equal(input.resourceIds.length, 2)
  assert.throws(() =>
    transferResourcesSchema.parse({
      action: "copy",
      resourceIds: [],
      targetVaultId: "f9a4f3dd-4a09-42f5-9d4f-e81556767421",
      targetSpaceId: "6886d566-0be7-4ab7-b5e3-0ced26fc04e4",
    })
  )
})

test("description schemas accept long text", () => {
  const description = "长描述".repeat(1500)

  assert.equal(
    createResourceSchema.parse({
      url: "https://example.com/resource",
      description,
    }).description,
    description
  )
  assert.equal(updateResourceSchema.parse({ description }).description, description)
  assert.equal(
    createResourceSubmissionSchema.parse({
      url: "https://example.com/submission",
      description,
      turnstileToken: "token",
    }).description,
    description
  )
  assert.equal(
    createVaultSchema.parse({
      title: "Long description vault",
      description,
    }).description,
    description
  )
  assert.equal(
    createSpaceSchema.parse({
      name: "Long description space",
      description,
    }).description,
    description
  )
})

test("resource input extracts ed2k and thunder file hints", () => {
  assert.deepEqual(parseResourceInput({ url: "ed2k://|file|demo.mkv|1048576|HASH|/" }), {
    type: "other",
    url: "ed2k://|file|demo.mkv|1048576|HASH|/",
    title: "demo.mkv",
    metadata: {
      protocol: "ed2k",
      fileName: "demo.mkv",
      fileSize: 1048576,
      size: 1048576,
      fileExtension: "mkv",
      fileType: "video",
      hash: "HASH",
    },
  })
  assert.deepEqual(parseResourceInput({ url: "thunder://QUFodHRwczovL2V4YW1wbGUuY29tL3NvbWUuemlwWlo=" }), {
    type: "other",
    url: "thunder://QUFodHRwczovL2V4YW1wbGUuY29tL3NvbWUuemlwWlo=",
    title: "some.zip",
    metadata: {
      protocol: "thunder",
      decodedUrl: "https://example.com/some.zip",
      fileName: "some.zip",
      fileExtension: "zip",
      fileType: "archive",
    },
  })
})

test("resource input stores clean canonical magnet urls", () => {
  const parsed = parseResourceInput({
    url: "magnet:?xt=urn:btih:a70d99267b66b600b6469dfc8884034ef8cad98c&dn=Demo&tr=udp://tracker.example/announce",
  })

  assert.equal(parsed.type, "magnet")
  assert.equal(
    parsed.url,
    "magnet:?xt=urn:btih:A70D99267B66B600B6469DFC8884034EF8CAD98C"
  )
  assert.equal(parsed.title, "Demo")
  assert.equal(parsed.metadata?.infoHash, "A70D99267B66B600B6469DFC8884034EF8CAD98C")

  const fallbackTitle = parseResourceInput({
    url: "magnet:?xt=urn:btih:a70d99267b66b600b6469dfc8884034ef8cad98c&dn=FromDn",
    title: "名称未知",
  })
  assert.equal(fallbackTitle.title, "FromDn")

  const directHash = parseResourceInput({
    url: "a70d99267b66b600b6469dfc8884034ef8cad98c",
  })
  assert.equal(directHash.type, "magnet")
  assert.equal(
    directHash.url,
    "magnet:?xt=urn:btih:A70D99267B66B600B6469DFC8884034EF8CAD98C"
  )
})

test("resource input detects telegram message urls", () => {
  assert.deepEqual(parseResourceInput({ url: "https://t.me/example_channel/42?single" }), {
    type: "telegram",
    url: "https://t.me/example_channel/42",
    title: "Telegram message",
    metadata: {
      chatUsername: "example_channel",
      internalChatId: undefined,
      messageId: "42",
    },
  })

  assert.deepEqual(parseResourceInput({ url: "https://t.me/c/123456789/987" }), {
    type: "telegram",
    url: "https://t.me/c/123456789/987",
    title: "Telegram message",
    metadata: {
      chatUsername: undefined,
      internalChatId: "123456789",
      messageId: "987",
    },
  })

  assert.deepEqual(parseResourceInput({ url: "https://t.me/s/example_channel/43" }), {
    type: "telegram",
    url: "https://t.me/example_channel/43",
    title: "Telegram message",
    metadata: {
      chatUsername: "example_channel",
      internalChatId: undefined,
      messageId: "43",
    },
  })
})

test("resource input detects cloud drive share urls and extraction codes", () => {
  const cases = [
    {
      url: "https://pan.baidu.com/s/xxxxxxx?pwd=8888",
      type: "baidu_pan",
      password: "8888",
    },
    {
      url: "https://115cdn.com/s/xxxxxxx?password=u2f3",
      type: "pan_115",
      password: "u2f3",
    },
    {
      url: "https://123865.com/s/xxxxxxx?pwd=Ftsn",
      type: "pan_123",
      password: "Ftsn",
    },
    {
      url: "https://pan.quark.cn/s/xxxxxxx",
      type: "quark_pan",
      password: undefined,
    },
    {
      url: "https://drive.uc.cn/s/xxxxxxx",
      type: "uc_pan",
      password: undefined,
    },
    {
      url: "https://pan.xunlei.com/s/xxxxxxx?pwd=zqbb",
      type: "xunlei_pan",
      password: "zqbb",
    },
    {
      url: "https://mypikpak.com/s/xxxxxxx",
      type: "pikpak",
      password: undefined,
    },
  ] as const

  for (const item of cases) {
    const parsed = parseResourceInput({ url: item.url })
    assert.equal(parsed.type, item.type)
    assert.equal(parsed.metadata?.password, item.password)
    assert.equal(parsed.metadata?.shareId, "xxxxxxx")
  }

  const quark = parseResourceInput({
    url: "https://pan.quark.cn/s/xxxxxxx",
    extractionCode: "abcd",
  })
  assert.equal(quark.metadata?.password, "abcd")
  assert.match(quark.url, /passcode=abcd/)

  const xunlei = parseResourceInput({
    url: "https://pan.xunlei.com/s/xxxxxxx?pwd=zqbb",
    extractionCode: "next",
  })
  assert.equal(xunlei.metadata?.password, "next")
  assert.match(xunlei.url, /pwd=next/)

  assert.equal(parseResourceInput({ url: "https://pan.quark.cn/list/xxxxxxx" }).type, "http")
})

test("permission matrix keeps editors focused on contribution and anonymous read only", () => {
  assert.equal(can("editor", "vault:read"), true)
  assert.equal(can("editor", "resource:create"), true)
  assert.equal(can("editor", "collaborator:manage"), false)
  assert.equal(can("editor", "share:manage"), false)
  assert.equal(can("anonymous", "vault:read"), true)
  assert.equal(can("anonymous", "resource:create"), false)
})
