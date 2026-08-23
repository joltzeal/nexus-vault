import { getSocialVideoMediaProxyResponse } from "@/server/social-video-media-proxy"

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get("url")?.trim()
  if (!sourceUrl) return new Response("Missing media URL.", { status: 400 })
  return getSocialVideoMediaProxyResponse(request, sourceUrl)
}
