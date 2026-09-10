import assert from "node:assert/strict"
import test from "node:test"

import { parseResourceInput, parseMegaLink } from "../../domain/resources/input"
import { createMetadataQueueMessage } from "../messages"
import { getMetadataProvider } from "../metadata-provider"

const MEGA_FOLDER_URL = "https://mega.nz/folder/PxYG3ZBI#5VclV6gqqy3fBxduTXk_cw"

test("MEGA folder links are parsed and routed to the dedicated provider", () => {
  const parsedLink = parseMegaLink(MEGA_FOLDER_URL)
  assert.deepEqual(parsedLink, {
    handle: "PxYG3ZBI",
    host: "mega.nz",
    key: "5VclV6gqqy3fBxduTXk_cw",
    kind: "folder",
    url: MEGA_FOLDER_URL,
  })

  const parsed = parseResourceInput({ url: "https://mega.nz/folder/PxYG3ZBI?source=share#5VclV6gqqy3fBxduTXk_cw" })
  assert.deepEqual(parsed, {
    type: "mega",
    url: MEGA_FOLDER_URL,
    title: "MEGA folder",
    metadata: {
      handle: "PxYG3ZBI",
      host: "mega.nz",
      key: "5VclV6gqqy3fBxduTXk_cw",
      kind: "folder",
    },
  })
  assert.equal(getMetadataProvider({ type: "http", url: parsed.url }).name, "mega")
  assert.equal(
    createMetadataQueueMessage("vault", "resource", parsed.type, parsed.url).dedupeKey,
    "mega:folder:PxYG3ZBI:5VclV6gqqy3fBxduTXk_cw",
  )
})
