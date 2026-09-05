import { eq } from "drizzle-orm"

import { resourceMetadata } from "../../../../../../../db/schema"
import { normalizeResourceMetadata } from "../../../../../../../domain/resources/metadata"
import { notFound } from "../../../../../../../lib/errors"
import { handleApiRequest } from "../../../../../../../lib/http"
import { getGofileMediaProxyResponse } from "../../../../../../../storage/gofile-media-proxy"
import { requireResourceReadPermission, getResourceOrThrow } from "../../../../../../../services/resource-service"

type Context = {
  params: Promise<{ mediaIndex: string; resourceId: string }>
}

export async function GET(request: Request, { params }: Context) {
  const { mediaIndex: mediaIndexValue, resourceId } = await params

  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, env }) => {
    if (!/^\d+$/.test(mediaIndexValue)) throw notFound("Media not found.")
    const resource = await getResourceOrThrow(db, resourceId)
    await requireResourceReadPermission(db, resource, actor)

    const [row] = await db
      .select({ dataJson: resourceMetadata.dataJson })
      .from(resourceMetadata)
      .where(eq(resourceMetadata.resourceId, resourceId))
      .limit(1)
    const metadata = normalizeResourceMetadata(row?.dataJson)
    const media = metadata?.media?.[Number.parseInt(mediaIndexValue, 10)]
    if (
      !media ||
      media.provider !== "gofile" ||
      (media.kind !== "image" && media.kind !== "video")
    ) {
      throw notFound("Media not found.")
    }

    const variant = new URL(request.url).searchParams.get("variant")
    const sourceUrl = variant === "thumbnail" ? media.thumbnailUrl : media.url
    if (typeof sourceUrl !== "string" || !sourceUrl.trim()) throw notFound("Media not found.")

    return getGofileMediaProxyResponse(request, sourceUrl, env)
  })
}
