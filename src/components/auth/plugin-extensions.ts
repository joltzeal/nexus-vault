import type { AuthView } from "@better-auth-ui/core"
import type { ComponentType, ReactNode } from "react"

import type { SocialLayout } from "./provider-buttons"

type AuthViewProps = {
  className?: string
  socialLayout?: SocialLayout
  socialPosition?: "top" | "bottom"
}

type AuthButtonProps = {
  view: AuthView
}

export type AuthPluginExtensions = {
  authButtons?: Array<ComponentType<AuthButtonProps>>
  captchaComponent?: ReactNode
  fallbackViews?: {
    auth?: Partial<Record<string, ComponentType<AuthViewProps>>>
  }
  views?: {
    auth?: Partial<Record<string, ComponentType<AuthViewProps>>>
  }
}

export function authPluginExtensions<TPlugin>(plugin: TPlugin) {
  return plugin as TPlugin & AuthPluginExtensions
}
