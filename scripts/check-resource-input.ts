import { parseResourceInput } from "@nexus-vault/shared/resource-input"

const input =
  "magnet:?xt=urn:btih:a70d99267b66b600b6469dfc8884034ef8cad98c&dn=%E6%BF%80%E6%83%85%E9%AA%9A%E9%BA%A6&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.opentrackr.org:1337/announce"

const parsed = parseResourceInput({ url: input })

assertEqual(parsed.type, "magnet", "type")
assertEqual(
  parsed.url,
  "magnet:?xt=urn:btih:A70D99267B66B600B6469DFC8884034EF8CAD98C",
  "stored clean magnet URL"
)
assertEqual(parsed.title, "激情骚麦", "display name title")
assertEqual(parsed.metadata?.infoHash, "A70D99267B66B600B6469DFC8884034EF8CAD98C", "info hash")

if ("trackers" in (parsed.metadata ?? {})) {
  throw new Error("metadata must not contain trackers")
}

const tweet = parseResourceInput({
  url: "https://x.com/twitter/status/20?foo=bar",
})

assertEqual(tweet.type, "twitter", "tweet type")
assertEqual(tweet.url, "https://x.com/twitter/status/20", "canonical tweet URL")
assertEqual(tweet.title, "Untitled tweet", "tweet fallback title")
assertEqual(tweet.metadata?.tweetId, "20", "tweet ID")
assertEqual(tweet.metadata?.username, "twitter", "tweet username")

const baiduPan = parseResourceInput({
  url: "https://pan.baidu.com/s/1kJs6w9nEVU2oE9FcjuwrvA?pwd=3hg3",
})

assertEqual(baiduPan.type, "baidu_pan", "baidu pan type")
assertEqual(baiduPan.metadata?.host, "pan.baidu.com", "baidu pan host")
assertEqual(baiduPan.metadata?.provider, "baidu_pan", "baidu pan provider")
assertEqual(baiduPan.metadata?.password, "3hg3", "baidu pan password")
assertEqual(
  baiduPan.metadata?.shareId,
  "1kJs6w9nEVU2oE9FcjuwrvA",
  "baidu pan share ID"
)

const quarkPan = parseResourceInput({
  url: "https://pan.quark.cn/s/abc123#/list/share",
})

assertEqual(quarkPan.type, "quark_pan", "quark pan type")
assertEqual(quarkPan.metadata?.host, "pan.quark.cn", "quark pan host")
assertEqual(quarkPan.metadata?.provider, "quark_pan", "quark pan provider")

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}
