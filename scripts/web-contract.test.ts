import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { listDashboardVaults } from "../src/features/dashboard/api.ts"
import { getSharedVault } from "../src/features/share/api.ts"
import { listDashboardVaultResources } from "../src/features/vault/api/vault-api.ts"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("Web API contracts", () => {
  it("normalizes a dashboard vault list envelope", async () => {
    let requestedUrl = ""
    let credentials: RequestCredentials | undefined
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input)
      credentials = init?.credentials
      return new Response(JSON.stringify({
        success: true,
        data: { items: [{ id: "v-1", title: "Personal", resourceCount: 2 }] },
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }

    const result = await listDashboardVaults()

    assert.equal(result[0]?.id, "v-1")
    assert.equal(requestedUrl, "/api/v1/vaults")
    assert.equal(credentials, "include")
  })

  it("surfaces API error messages instead of silently accepting failures", async () => {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, error: { message: "Session expired" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )

    await assert.rejects(listDashboardVaults(), /Session expired/)
  })

  it("encodes shared-vault slugs and returns the ready detail", async () => {
    let requestedUrl = ""
    globalThis.fetch = async (input) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({
        success: true,
        data: { status: "ready", detail: { vault: { id: "v-1" }, spaces: [], resources: [] } },
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }

    const result = await getSharedVault("team vault/2026")

    assert.equal(result.status, "ready")
    assert.match(requestedUrl, /\/api\/v1\/shares\/team%20vault%2F2026$/)
  })

  it("loads a vault-wide resource window without a space filter", async () => {
    let requestedUrl = ""
    globalThis.fetch = async (input) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({
        success: true,
        data: { items: [], nextCursor: null },
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }

    await listDashboardVaultResources("vault-1", { cursor: "next-page" })

    const url = new URL(requestedUrl, "https://nexus-vault.test")
    assert.equal(url.pathname, "/api/v1/vaults/vault-1/resources")
    assert.equal(url.searchParams.get("spaceId"), null)
    assert.equal(url.searchParams.get("cursor"), "next-page")
    assert.equal(url.searchParams.get("limit"), "50")
  })
})
