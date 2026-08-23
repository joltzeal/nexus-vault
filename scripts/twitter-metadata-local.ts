import { randomUUID } from "node:crypto"

import { parseResourceInput } from "@/domain/resources/input"
import { getMetadataProvider } from "@/server/metadata/metadata-provider"

type CliInput = {
  cookieString?: string
  url?: string
}

async function main() {
  const input = parseCliInput(process.argv.slice(2))
  const url = input.url?.trim()

  if (!url) {
    console.error(
      'Usage: pnpm twitter:metadata -- "https://x.com/user/status/123" [--cookie "auth_token=...; ct0=..."]',
    )
    process.exit(1)
  }

  const parsed = parseResourceInput({ url })

  if (parsed.type !== "twitter") {
    console.error(`Expected an x.com tweet URL, got resource type "${parsed.type}".`)
    process.exit(1)
  }

  const now = new Date().toISOString()
  const resource = {
    id: randomUUID(),
    vaultId: randomUUID(),
    spaceId: randomUUID(),
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
  const cookieString =
    input.cookieString?.trim() ||
    process.env.X_COM_COOKIE_STRING?.trim() ||
    undefined
  console.log("Resource:", {
    provider: provider.name,
    type: resource.type,
    url: resource.url,
    title: resource.title,
  })

  if (cookieString) {
    console.log("Using x.com cookies:", getCookieNames(cookieString).join(", "))
  } else {
    console.log("Using x.com cookies: none")
  }

  const result = await provider.resolve(resource, {
    twitterCookieString: cookieString,
  })

  console.log(JSON.stringify(result, null, 2))
}

function parseCliInput(args: string[]): CliInput {
  const input: CliInput = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--cookie") {
      input.cookieString = args[index + 1]
      index += 1
      continue
    }
    if (!arg.startsWith("--") && !input.url) {
      input.url = arg
    }
  }

  return input
}

function getCookieNames(cookieString: string) {
  return cookieString
    .split(";")
    .map((part) => part.trim().split("=")[0]?.trim())
    .filter(Boolean)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
