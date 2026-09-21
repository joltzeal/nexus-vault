import { parseResourceInput } from "../worker/domain/resources/input"
import { getMetadataProvider } from "../worker/metadata/metadata-provider"

const inputUrl = findInputUrl(process.argv.slice(2))

if (!inputUrl) {
  throw new Error("Usage: pnpm test:gofile -- https://gofile.io/d/<contentId>")
}

const parsed = parseResourceInput({ url: inputUrl })
const nativeFetch = globalThis.fetch

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, init)
  const url = getRequestUrl(input)

  if (url.startsWith("https://api.gofile.io/contents/")) {
    const body = await response.clone().json().catch(async () => response.clone().text())
    console.log("\n[gofile] raw metadata response")
    console.log(JSON.stringify({
      url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }, null, 2))
  }

  return response
}

try {
  const provider = getMetadataProvider({ type: parsed.type, url: parsed.url })
  const result = await provider.resolve({
    id: "local-gofile-test",
    type: parsed.type,
    title: parsed.title,
    description: "",
    url: parsed.url,
  }, {
    gofileApiToken: process.env.GOFILE_API_TOKEN || process.env.GOFILE_TOKEN,
  })

  console.log("\n[gofile] parsed input and normalized metadata")
  console.log(JSON.stringify({ input: parsed, result }, null, 2))
} finally {
  globalThis.fetch = nativeFetch
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function findInputUrl(args: string[]) {
  for (const argument of args) {
    if (argument === "--") continue

    const value = argument.trim()
    const markdownStart = value.indexOf("](")
    const markdownCandidate = markdownStart >= 0
      ? value.slice(markdownStart + 2).split(")", 1)[0]
      : undefined
    const candidate = markdownCandidate?.startsWith("http")
      ? markdownCandidate
      : value.match(/https?:\/\/[^\s\])]+/i)?.[0]
    if (candidate) return candidate.replace(/\\/g, "")
  }

  return undefined
}
