import { API as MegaApi } from "megajs"

import { parseResourceInput } from "../worker/domain/resources/input"
import { megaMetadataProvider } from "../worker/metadata/providers/mega"

const inputUrl = findInputUrl(process.argv.slice(2))

if (!inputUrl) {
  throw new Error("Usage: pnpm test:mega -- https://mega.nz/folder/<handle>#<key>")
}

const parsed = parseResourceInput({ url: inputUrl })
const megaApi = new MegaApi(false, { fetch: loggingFetch })
const result = await megaMetadataProvider.resolve({
  id: "local-mega-test",
  type: parsed.type,
  title: parsed.title,
  description: "",
  url: parsed.url,
}, {
  megaApi,
  onMegaDecryptedContent(value) {
    console.log("\n[mega] decrypted content")
    console.log(JSON.stringify(value, null, 2))
  },
})

console.log(JSON.stringify({ input: parsed, result }, null, 2))

async function loggingFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  const body = await response.clone().text()

  console.log("\n[mega] raw response", {
    url: String(input),
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  })

  return response
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
    if (candidate) return normalizeInputUrl(candidate)
  }

  return undefined
}

function normalizeInputUrl(value: string) {
  return value.replace(/\\/g, "")
}
