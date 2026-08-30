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
      return <XProfileCard {...chrome} data={preview.data} state={state} viewMode={viewMode} />
    case "x_post":
      return <XPostCard {...chrome} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "github_user":
      return <GitHubUserCard {...chrome} data={preview.data} state={state} viewMode={viewMode} />
    case "github_repository":
      return <GitHubRepositoryCard {...chrome} data={preview.data} state={state} viewMode={viewMode} />
    case "github_release":
      return <GitHubReleaseCard {...chrome} data={preview.data} state={state} viewMode={viewMode} />
    case "telegram_message":
      return <TelegramMessageCard {...chrome} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "wechat_mp_article":
      return <WechatMpArticleCard {...chrome} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
    case "social_video":
      return <SocialVideoCard {...chrome} data={preview.data} mediaVisible={mediaVisible} state={state} viewMode={viewMode} />
  }
}
