import {
  Boxes,
  Check,
  FolderGit2,
  Link2,
  LockKeyhole,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
} from "lucide-react"

import type { RegistrationMode } from "@/auth/registration"
import { HomeAuthActions } from "@/features/components/home-auth-actions"

const resourceRows = [
  {
    type: "MAGNET",
    title: "纪录片合集 · 蓝光修复版",
    meta: "自动识别文件与哈希",
  },
  {
    type: "VIDEO",
    title: "团队评审录屏",
    meta: "媒体预览与评论同步",
  },
  {
    type: "LINK",
    title: "产品资料与参考链接",
    meta: "标题、来源与标签归档",
  },
]

const features = [
  {
    icon: Link2,
    title: "资源统一收纳",
    body: "链接、磁力、网盘、视频与文档进入同一套资源模型，便于整理、检索和分享。",
  },
  {
    icon: Boxes,
    title: "按 Space 组织",
    body: "把一个 Vault 拆成清晰章节，资源可以按主题归档，也可以在协作中持续调整位置。",
  },
  {
    icon: MessageCircle,
    title: "讨论保留上下文",
    body: "评论跟随具体资源，重要补充不会散落在聊天记录里，成员可以直接围绕资料协作。",
  },
]

const trustItems = ["私有优先", "密码分享", "成员权限", "可控评论"]

export function Home({
  registrationMode,
  turnstileSiteKey,
}: {
  registrationMode: RegistrationMode
  turnstileSiteKey?: string
}) {
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1180px] flex-col px-4 py-5 md:px-7">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold">
            <span className="grid size-7 place-items-center rounded-[7px] bg-linear-to-br from-jade to-[#2a9c93] text-[13px] font-bold text-[#04140f] shadow-[0_0_0_1px_rgba(63,216,176,.4),0_4px_14px_-4px_var(--jade)]">
              N
            </span>
            <span>
              Nexus<span className="text-jade">Vault</span>
            </span>
          </div>

          <HomeAuthActions
            placement="header"
            registrationMode={registrationMode}
            turnstileSiteKey={turnstileSiteKey}
          />
        </header>

        <div className="grid flex-1 gap-8 py-12 md:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-chip border border-jade-dim bg-[var(--jade-glow)] px-3 py-1 text-xs font-medium text-jade">
              <Shield />
              私有资料库与协作工作台
            </div>
            <h1 className="mt-5 max-w-[720px] font-display text-[40px] font-semibold leading-[1.04] text-fg md:text-[64px]">
              把重要资源整理成可协作的 Vault。
            </h1>
            <p className="mt-5 max-w-[610px] text-[15px] leading-7 text-fg-muted md:text-base">
              NexusVault 帮你收纳链接、磁力、网盘、视频和文档资料。每个资源都有清晰归属、访问权限、评论上下文和可分享入口。
            </p>
            <HomeAuthActions
              placement="hero"
              registrationMode={registrationMode}
              turnstileSiteKey={turnstileSiteKey}
            />

            <div className="mt-8 grid max-w-[560px] gap-2 sm:grid-cols-2">
              {trustItems.map((item) => (
                <div
                  className="flex items-center gap-2 rounded-input border border-line bg-ink-850/70 px-3 py-2 text-sm text-fg-muted"
                  key={item}
                >
                  <Check className="text-jade" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-card border border-line bg-ink-850 p-3 shadow-pop">
              <div className="flex items-center justify-between border-b border-line px-1 pb-3">
                <div>
                  <p className="font-display text-sm font-semibold text-fg">
                    Research Vault
                  </p>
                  <p className="mt-1 text-xs text-fg-dim">
                    3 spaces · 128 resources
                  </p>
                </div>
                <div className="grid size-9 place-items-center rounded-card border border-line bg-ink-900 text-jade">
                  <FolderGit2 />
                </div>
              </div>

              <div className="grid gap-3 pt-3">
                <div className="rounded-card border border-line-soft bg-ink-900 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg">
                      媒体资料
                    </span>
                    <span className="mono text-[10px] text-fg-dim">42 items</span>
                  </div>
                  <div className="grid gap-2">
                    {resourceRows.map((row) => (
                      <div
                        className="grid grid-cols-[64px_1fr] gap-3 rounded-input border border-line-soft bg-ink-850 px-3 py-2"
                        key={row.title}
                      >
                        <span className="mono text-[10px] font-semibold text-jade">
                          {row.type}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-fg">
                            {row.title}
                          </span>
                          <span className="block truncate text-xs text-fg-dim">
                            {row.meta}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-card border border-line-soft bg-ink-900 p-3">
                    <Search className="text-jade" />
                    <p className="mt-3 text-sm font-semibold text-fg">快速检索</p>
                    <p className="mt-1 text-xs leading-5 text-fg-dim">
                      从标题、链接、标签和资源描述中定位资料。
                    </p>
                  </div>
                  <div className="rounded-card border border-line-soft bg-ink-900 p-3">
                    <LockKeyhole className="text-jade" />
                    <p className="mt-3 text-sm font-semibold text-fg">安全分享</p>
                    <p className="mt-1 text-xs leading-5 text-fg-dim">
                      私有、公开和密码访问可以按 Vault 设置。
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-8 -top-8 hidden rounded-card border border-line bg-ink-900 px-3 py-2 text-xs text-fg-muted shadow-pop md:block">
              <Sparkles className="mr-2 inline text-jade" />
              自动补全资源信息
            </div>
          </div>
        </div>

        <section className="grid gap-3 border-t border-line py-5 md:grid-cols-3">
          {features.map(({ body, icon: Icon, title }) => (
            <article
              className="rounded-card border border-line bg-ink-850/70 p-4"
              key={title}
            >
              <Icon className="text-jade" />
              <h2 className="mt-3 font-display text-sm font-semibold text-fg">
                {title}
              </h2>
              <p className="mt-2 text-[12.5px] leading-5 text-fg-muted">
                {body}
              </p>
            </article>
          ))}
        </section>
      </section>
    </div>
  )
}
