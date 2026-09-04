import { XSourceIcon } from "./platform-icons"
import { formatPreviewDate, ResourceCardFrame } from "./resource-card-frame"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  XPostCardData,
} from "./types"
import { TweetCardContent, TweetSkeleton } from "@/features/resource/tweet-card"

export function XPostCard({
  actions,
  annotation,
  articleId,
  articleRef,
  className,
  commentAction,
  commentEditor,
  data,
  footerActions,
  leadingControl,
  mediaVisible = true,
  onActivate,
  resourceCreatedAt,
  state,
  viewMode,
}: ResourceCardChromeProps & {
  data: XPostCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const createdAt = data.tweet?.created_at || data.createdAt

  return (
    <ResourceCardFrame
      actions={actions}
      annotation={annotation}
      articleId={articleId}
      articleRef={articleRef}
      className={className}
      commentAction={commentAction}
      commentEditor={commentEditor}
      footerActions={footerActions}
      footerMeta={createdAt ? (
        <time className="mono" dateTime={createdAt}>
          {formatPreviewDate(createdAt)}
        </time>
      ) : undefined}
      leadingControl={leadingControl}
      onActivate={onActivate}
      resourceCreatedAt={resourceCreatedAt}
      sourceIcon={<XSourceIcon />}
      sourceName="Tweet"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <TweetSkeleton media={mediaVisible} />
      ) : (
        <TweetCardContent data={data} mediaVisible={mediaVisible} viewMode={viewMode} />
      )}
    </ResourceCardFrame>
  )
}
