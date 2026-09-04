import { GitHubReleaseCard } from "./github-release-card"
import { GitHubRepositoryCard } from "./github-repository-card"
import { GitHubUserCard } from "./github-user-card"
import { SocialVideoCard } from "./social-video-card"
import { TelegramMessageCard } from "./telegram-message-card"
import { WechatMpArticleCard } from "./wechat-mp-article-card"
import type {
  ResourceCardChromeProps,
  ResourceCardPreview,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types"
import { XPostCard } from "./x-post-card"
import { XProfileCard } from "./x-profile-card"

export function ResourcePreviewCard({
  mediaVisible = true,
  preview,
  resourceCreatedAt,
  state = "ready",
  viewMode = "list",
  ...chrome
}: ResourceCardChromeProps & {
  mediaVisible?: boolean
  preview: ResourceCardPreview
  state?: ResourcePreviewRenderState
  viewMode?: ResourceCardViewMode
}) {
  switch (preview.kind) {
    case "x_profile":
      return <XProfileCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} state={state} viewMode={viewMode} />
    case "x_post":
      return <XPostCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "github_user":
      return <GitHubUserCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} state={state} viewMode={viewMode} />
    case "github_repository":
      return <GitHubRepositoryCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} state={state} viewMode={viewMode} />
    case "github_release":
      return <GitHubReleaseCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} state={state} viewMode={viewMode} />
    case "telegram_message":
      return <TelegramMessageCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "wechat_mp_article":
      return <WechatMpArticleCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "social_video":
      return <SocialVideoCard {...chrome} resourceCreatedAt={resourceCreatedAt} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
  }
}
