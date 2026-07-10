import { getMetadataProvider } from "@nexus-vault/providers"
import { parseResourceInput } from "@nexus-vault/shared/resource-input"

async function main() {
  const url = process.argv[2]?.trim()

  if (!url) {
    console.error('Usage: tsx scripts/twitter-scraper-local.ts "https://x.com/user/status/123"')
    process.exit(1)
  }

  const parsed = parseResourceInput({ url })

  if (parsed.type !== "twitter") {
    console.error(`Expected an x.com tweet URL, got resource type "${parsed.type}".`)
    process.exit(1)
  }

  const now = new Date().toISOString()
  const resource = {
    id: "resource_local-twitter-scraper",
    vaultId: "vault_local",
    spaceId: "space_local",
    type: parsed.type,
    title: parsed.title,
    description: "",
    url: parsed.url,
    metadataStatus: "pending" as const,
    position: 0,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }

  const provider = getMetadataProvider(resource)
  const cookieString = process.env.TWITTER_COOKIE_STRING?.trim()

  if (cookieString) {
    const cookieNames = cookieString
      .split(";")
      .map((part) => part.trim().split("=")[0])
      .filter(Boolean)
    console.log("Using Twitter cookies:", cookieNames.join(", "))
  }

  const result = await provider.resolve(resource, {
    twitterRequestProxyUrl: process.env.TWITTER_REQUEST_PROXY_URL?.trim() || undefined,
    twitterCookieString: cookieString || undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
