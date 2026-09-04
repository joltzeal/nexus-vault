import { IconGithub, IconReddit, IconTelegram, IconTikTok, IconTwitter, IconWechat } from "@/components/icons/resource-type"

export function XSourceIcon() {
  return <IconTwitter aria-hidden="true" className="size-6" />
}

export function RedditSourceIcon() {
  return <IconReddit aria-hidden="true" className="size-6 text-[#ff4500]" />
}

export function GitHubSourceIcon() {
  return (
    <IconGithub aria-hidden="true" className="size-6 text-foreground" />
  )
}

export function TelegramSourceIcon() {
  return <IconTelegram aria-hidden="true" className="size-6" />
}

export function TikTokSourceIcon() {
  return <IconTikTok aria-hidden="true" className="size-6" />
}

export function WechatSourceIcon() {
  return <IconWechat aria-hidden="true" className="size-6" />
}
