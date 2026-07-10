import assert from "node:assert/strict"
import test from "node:test"

import { parseResourceInput } from "../../../../packages/shared/src/resource-input"
import { can } from "../../../../packages/shared/src/permissions"
import { createSpaceSchema, updateSpaceSchema } from "./schemas/space"

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

test("permission matrix keeps viewers read/comment only and anonymous read only", () => {
  assert.equal(can("viewer", "vault:read"), true)
  assert.equal(can("viewer", "comment:create"), true)
  assert.equal(can("viewer", "resource:create"), false)
  assert.equal(can("anonymous", "vault:read"), true)
  assert.equal(can("anonymous", "comment:create"), false)
})
