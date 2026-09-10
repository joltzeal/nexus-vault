import { parseResourceInput } from "../worker/domain/resources/input"
import { megaMetadataProvider } from "../worker/metadata/providers/mega"

const inputUrl = findInputUrl(process.argv.slice(2))

if (!inputUrl) {
  throw new Error("Usage: pnpm test:mega -- https://mega.nz/folder/<handle>#<key>")
}

const parsed = parseResourceInput({ url: inputUrl })
const result = await megaMetadataProvider.resolve({
  id: "local-mega-test",
  type: parsed.type,
  title: parsed.title,
  description: "",
  url: parsed.url,
})

console.log(JSON.stringify({ input: parsed, result }, null, 2))

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
