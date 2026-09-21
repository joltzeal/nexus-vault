import assert from "node:assert/strict"
import test from "node:test"

import type { NormalizedResourceMetadata } from "./metadata"
import { selectMetadataForPersistence } from "./metadata-persistence"

const previous = createMetadata({
  title: "Existing title",
  media: [{ kind: "image", url: "https://example.com/existing.jpg" }],
  tree: [{ name: "existing.jpg", type: "image" }],
  availability: { status: "available", checkedAt: "2026-09-20T00:00:00.000Z" },
})

test("successful metadata retries replace previous metadata", () => {
  const next = createMetadata({
    title: "Fresh title",
    media: [{ kind: "image", url: "https://example.com/fresh.jpg" }],
    tree: [{ name: "fresh.jpg", type: "image" }],
    availability: { status: "available", checkedAt: "2026-09-21T00:00:00.000Z" },
  })

  assert.deepEqual(selectMetadataForPersistence({
    next,
    previous,
    status: "completed",
  }), { data: next, preserved: false })
})

test("failed metadata retries preserve previous metadata", () => {
  const next = createMetadata({ title: "Failed result", tree: [] })

  assert.deepEqual(selectMetadataForPersistence({
    next,
    previous,
    status: "failed",
  }), { data: previous, preserved: true })
})

test("unavailable metadata retries only update availability", () => {
  const availability = {
    status: "unavailable",
    reason: "Share expired.",
    checkedAt: "2026-09-21T00:00:00.000Z",
  }
  const next = createMetadata({ title: "Empty result", tree: [], availability })
  const result = selectMetadataForPersistence({ next, previous, status: "completed" })

  assert.equal(result.preserved, true)
  assert.equal(result.data.title, "Existing title")
  assert.deepEqual(result.data.media, previous.media)
  assert.deepEqual(result.data.tree, previous.tree)
  assert.deepEqual(
    (result.data.extra?.cloudDrive as Record<string, unknown>)?.availability,
    availability,
  )
})

test("scheduled availability checks never replace metadata contents", () => {
  const availability = {
    status: "available",
    checkedAt: "2026-09-21T00:00:00.000Z",
  }
  const next = createMetadata({ title: "Probe title", tree: [], availability })
  const result = selectMetadataForPersistence({
    mode: "availability-only",
    next,
    previous,
    status: "completed",
  })

  assert.equal(result.preserved, true)
  assert.equal(result.data.title, "Existing title")
  assert.deepEqual(result.data.media, previous.media)
  assert.deepEqual(result.data.tree, previous.tree)
  assert.deepEqual(
    (result.data.extra?.cloudDrive as Record<string, unknown>)?.availability,
    availability,
  )
})

function createMetadata(input: {
  availability?: Record<string, unknown>
  media?: NormalizedResourceMetadata["media"]
  title: string
  tree: NormalizedResourceMetadata["tree"]
}): NormalizedResourceMetadata {
  return {
    schemaVersion: 1,
    type: "gofile",
    title: input.title,
    media: input.media,
    tree: input.tree,
    fetchedAt: "2026-09-19T00:00:00.000Z",
    extra: input.availability
      ? {
          cloudDrive: {
            provider: "gofile",
            availability: input.availability,
          },
        }
      : undefined,
  }
}
