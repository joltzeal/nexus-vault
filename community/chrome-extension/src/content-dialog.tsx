import { useEffect, useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type {
  AuthState,
  ExtensionRequest,
  ExtensionResponse,
  PreferredTarget,
  TransferTargetVault,
} from "./shared"

export type DialogMode = "resource" | "tweet"

type ResourceDraft = {
  description: string
  extractionCode: string
  referer: string
  title: string
  url: string
}

type CloudDriveProvider =
  | "baidu_pan"
  | "pan_115"
  | "pan_123"
  | "quark_pan"
  | "uc_pan"
  | "xunlei_pan"
  | "pikpak"

type ParsedCloudDriveLink = {
  provider: CloudDriveProvider
  password?: string
  url: string
}

type ContentDialogProps = {
  mode: DialogMode
  onClose: () => void
  referer: string
  url: string
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; auth: AuthState }
  | { status: "error"; message: string; authRequired?: boolean }

export function ContentResourceDialog({
  mode,
  onClose,
  referer,
  url,
}: ContentDialogProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" }>()
  const [draft, setDraft] = useState<ResourceDraft>(() => ({
    description: "",
    extractionCode: parseCloudDriveLink(url)?.password ?? "",
    referer,
    title: "",
    url,
  }))
  const cloudDrive = useMemo(
    () => parseCloudDriveLink(draft.url, draft.extractionCode),
    [draft.extractionCode, draft.url],
  )

  useEffect(() => {
    let mounted = true
    void sendMessage<AuthState>({ type: "GET_AUTH_STATE", refresh: true }).then((response) => {
      if (!mounted) return
      setState(
        response.ok
          ? { status: "ready", auth: response.data }
          : {
              status: "error",
              message: response.error,
              authRequired: response.authRequired,
            },
      )
    })
    return () => {
      mounted = false
    }
  }, [])

  function updateUrl(value: string) {
    const currentCloudDrive = parseCloudDriveLink(draft.url)
    const parsedCloudDrive = parseCloudDriveLink(value)
    const shouldResetExtractionCode =
      !parsedCloudDrive || parsedCloudDrive.provider !== currentCloudDrive?.provider

    setDraft((current) => ({
      ...current,
      extractionCode:
        parsedCloudDrive?.password ?? (shouldResetExtractionCode ? "" : current.extractionCode),
      url: value,
    }))
  }

  async function openLogin() {
    await sendMessage({ type: "OPEN_LOGIN" })
  }

  async function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.status !== "ready") return
    const target = getSelectedTarget(event.currentTarget, state.auth)
    if (!target) {
      setMessage({ text: "请选择 Vault 和 Space。", tone: "error" })
      return
    }

    const saveUrl =
      mode === "tweet"
        ? url
        : createCloudDriveUrlWithPassword(draft.url.trim(), draft.extractionCode.trim())
    if (!saveUrl) {
      setMessage({ text: "链接不能为空。", tone: "error" })
      return
    }

    setIsSubmitting(true)
    setMessage(undefined)

    const response = await sendMessage({
      type: "SAVE_RESOURCE",
      description: mode === "tweet" ? "" : draft.description,
      referer: mode === "tweet" ? referer : draft.referer,
      ...(mode === "resource" && draft.title.trim() ? { title: draft.title } : {}),
      url: saveUrl,
      vaultId: target.vaultId,
      spaceId: target.spaceId,
    })

    if (!response.ok) {
      setMessage({ text: response.error, tone: "error" })
      setIsSubmitting(false)
      return
    }

    await sendMessage({ type: "SET_PREFERRED_TARGET", target })
    setMessage({ text: `已保存到 ${target.vaultTitle} / ${target.spaceName}`, tone: "success" })
    window.setTimeout(onClose, 900)
  }

  return (
    <div className="nexus-vault-extension-scope fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 p-4 text-foreground">
      <section
        aria-label={mode === "tweet" ? "保存推文到 Nexus Vault" : "添加资源到 Nexus Vault"}
        aria-modal="true"
        className="flex max-h-[min(720px,calc(100dvh-2rem))] w-[min(520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-sm text-popover-foreground shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-foreground">
              {mode === "tweet" ? "保存推文" : "添加资源"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "tweet" ? "选择 Space 后直接保存。" : "添加链接后会自动补全展示信息。"}
            </p>
          </div>
          <Button aria-label="关闭" disabled={isSubmitting} onClick={onClose} size="icon-sm" type="button" variant="ghost">
            ×
          </Button>
        </header>

        <Separator />

        {state.status === "loading" ? (
          <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-6 text-muted-foreground">
            <Spinner />
            正在加载 Space...
          </div>
        ) : state.status === "error" && state.authRequired ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-muted-foreground">
            <p>当前浏览器还没有 Nexus Vault 登录态。</p>
            <Button onClick={() => void openLogin()} type="button">打开主页登录</Button>
          </div>
        ) : state.status === "error" ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-destructive">
            <p>{state.message}</p>
            <Button onClick={onClose} type="button" variant="outline">关闭</Button>
          </div>
        ) : !state.auth.connected ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-muted-foreground">
            <p>当前浏览器还没有 Nexus Vault 登录态。</p>
            <Button onClick={() => void openLogin()} type="button">打开主页登录</Button>
          </div>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submitResource(event)}>
            <FieldGroup className="min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4">
              {mode === "resource" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="nv-resource-url">链接（必填）</FieldLabel>
                    <Input
                      className="mono"
                      disabled={isSubmitting}
                      id="nv-resource-url"
                      placeholder="magnet:?xt=urn:btih:... 或 https://..."
                      value={draft.url}
                      onChange={(event) => updateUrl(event.target.value)}
                    />
                  </Field>

                  {cloudDrive && (
                    <Field>
                      <FieldLabel htmlFor="nv-resource-code">
                        {getCloudDriveProviderLabel(cloudDrive.provider)}提取码
                      </FieldLabel>
                      <Input
                        className="mono"
                        disabled={isSubmitting}
                        id="nv-resource-code"
                        placeholder="没有提取码可留空"
                        value={draft.extractionCode}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, extractionCode: event.target.value }))
                        }
                      />
                    </Field>
                  )}
                </>
              )}

              <TargetFields
                disabled={isSubmitting}
                preferred={state.auth.preferredTarget}
                targets={state.auth.targets}
              />

              {mode === "resource" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="nv-resource-title">标题</FieldLabel>
                    <Input
                      disabled={isSubmitting}
                      id="nv-resource-title"
                      placeholder="留空时由 metadata 管道补全"
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="nv-resource-referer">Referer</FieldLabel>
                    <Input
                      className="mono"
                      disabled={isSubmitting}
                      id="nv-resource-referer"
                      placeholder="可选，资源来源链接"
                      value={draft.referer}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, referer: event.target.value }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="nv-resource-description">描述</FieldLabel>
                    <Textarea
                      className="max-h-60 min-h-32 resize-y"
                      disabled={isSubmitting}
                      id="nv-resource-description"
                      placeholder="补充版本、来源或注意事项。"
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </Field>
                </>
              )}
            </FieldGroup>

            <Separator />

            {message && (
              <div
                className={
                  message.tone === "success"
                    ? "px-4 pt-3 text-sm text-primary"
                    : "px-4 pt-3 text-sm text-destructive"
                }
              >
                {message.text}
              </div>
            )}

            <footer className="flex justify-end gap-2 px-4 py-3">
              <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={isSubmitting || (mode === "resource" && !draft.url.trim())} type="submit">
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {isSubmitting ? (mode === "tweet" ? "保存中" : "添加中") : mode === "tweet" ? "保存" : "添加"}
              </Button>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}

function TargetFields({
  disabled,
  preferred,
  targets,
}: {
  disabled: boolean
  preferred?: PreferredTarget
  targets: TransferTargetVault[]
}) {
  const initial = findPreferredTarget(targets, preferred)
  const [vaultId, setVaultId] = useState(initial?.vaultId ?? targets[0]?.id ?? "")
  const selectedVault = targets.find((target) => target.id === vaultId) ?? targets[0]
  const [spaceId, setSpaceId] = useState(
    initial?.spaceId ?? selectedVault?.spaces[0]?.id ?? "",
  )

  useEffect(() => {
    if (!selectedVault) return
    const nextSpaceId =
      selectedVault.spaces.find((space) => space.id === spaceId)?.id ??
      selectedVault.spaces[0]?.id ??
      ""
    if (nextSpaceId !== spaceId) setSpaceId(nextSpaceId)
  }, [selectedVault, spaceId])

  return (
    <>
      <Field>
        <FieldLabel htmlFor="nv-resource-vault">Vault</FieldLabel>
        <NativeSelect
          className="w-full"
          disabled={disabled}
          id="nv-resource-vault"
          name="vaultId"
          value={vaultId}
          onChange={(event) => {
            const nextValue = event.target.value
            setVaultId(nextValue)
            const nextVault = targets.find((target) => target.id === nextValue)
            setSpaceId(nextVault?.spaces[0]?.id ?? "")
          }}
        >
          {targets.map((target) => (
            <NativeSelectOption key={target.id} value={target.id}>
              {target.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="nv-resource-space">Space</FieldLabel>
        <NativeSelect
          className="w-full"
          disabled={disabled}
          id="nv-resource-space"
          key={vaultId}
          name="spaceId"
          value={spaceId}
          onChange={(event) => setSpaceId(event.target.value)}
        >
          {(selectedVault?.spaces ?? []).map((space) => (
            <NativeSelectOption key={space.id} value={space.id}>
              {space.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  )
}

function getSelectedTarget(form: HTMLFormElement, state: AuthState) {
  const data = new FormData(form)
  const vaultId = String(data.get("vaultId") ?? "")
  const spaceId = String(data.get("spaceId") ?? "")
  const vault = state.targets.find((target) => target.id === vaultId)
  const space = vault?.spaces.find((item) => item.id === spaceId)

  return vault && space
    ? {
        vaultId: vault.id,
        vaultTitle: vault.title,
        spaceId: space.id,
        spaceName: space.name,
      }
    : undefined
}

function sendMessage<T = unknown>(message: ExtensionRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse<T>>
}

function findPreferredTarget(
  targets: TransferTargetVault[],
  preferred?: PreferredTarget,
) {
  if (preferred) {
    const vault = targets.find((item) => item.id === preferred.vaultId)
    const space = vault?.spaces.find((item) => item.id === preferred.spaceId)
    if (vault && space) {
      return {
        vaultId: vault.id,
        spaceId: space.id,
        vaultTitle: vault.title,
        spaceName: space.name,
      }
    }
  }

  const vault = targets.find((item) => item.spaces.length > 0)
  const space = vault?.spaces[0]
  return vault && space
    ? {
        vaultId: vault.id,
        spaceId: space.id,
        vaultTitle: vault.title,
        spaceName: space.name,
      }
    : undefined
}

function parseCloudDriveLink(
  url: string,
  extractionCode?: string,
): ParsedCloudDriveLink | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim())
  } catch {
    return null
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol.toLowerCase())) return null
  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "")
  const config = cloudDriveConfigs.find((item) => item.matchesHost(host))
  if (!config) return null

  const shareId = getCloudDriveShareId(parsedUrl)
  if (!shareId) return null

  const password = getCloudDrivePassword(parsedUrl, extractionCode)
  return {
    provider: config.provider,
    password,
    url: createCloudDriveUrl(parsedUrl, config, password),
  }
}

function getCloudDriveProviderLabel(provider: CloudDriveProvider) {
  return cloudDriveConfigs.find((item) => item.provider === provider)?.label ?? "网盘"
}

function createCloudDriveUrlWithPassword(url: string, password: string) {
  const parsed = parseCloudDriveLink(url, password)
  return parsed?.url ?? url.trim()
}

function getCloudDrivePassword(url: URL, fallback?: string) {
  return (
    fallback?.trim() ||
    url.searchParams.get("pwd")?.trim() ||
    url.searchParams.get("password")?.trim() ||
    url.searchParams.get("passcode")?.trim() ||
    undefined
  )
}

function getCloudDriveShareId(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean)
  const shareIndex = segments.findIndex((segment) => ["s", "share"].includes(segment))
  return shareIndex >= 0 ? segments[shareIndex + 1] : undefined
}

function createCloudDriveUrl(
  url: URL,
  config: (typeof cloudDriveConfigs)[number],
  password?: string,
) {
  const normalizedUrl = new URL(url.toString())
  if (config.passwordParam && password?.trim()) {
    normalizedUrl.searchParams.set(config.passwordParam, password.trim())
  }
  return normalizedUrl.toString()
}

const cloudDriveConfigs: Array<{
  provider: CloudDriveProvider
  label: string
  passwordParam?: "pwd" | "password" | "passcode"
  matchesHost: (host: string) => boolean
}> = [
  {
    provider: "baidu_pan",
    label: "百度网盘",
    passwordParam: "pwd",
    matchesHost: (host) => host === "pan.baidu.com",
  },
  {
    provider: "pan_115",
    label: "115 盘",
    passwordParam: "password",
    matchesHost: (host) => host === "115cdn.com",
  },
  {
    provider: "pan_123",
    label: "123 云盘",
    passwordParam: "pwd",
    matchesHost: (host) => /^123\d{3}\.com$/.test(host),
  },
  {
    provider: "quark_pan",
    label: "夸克网盘",
    passwordParam: "passcode",
    matchesHost: (host) => host === "pan.quark.cn",
  },
  {
    provider: "uc_pan",
    label: "UC 网盘",
    passwordParam: "passcode",
    matchesHost: (host) => host === "drive.uc.cn",
  },
  {
    provider: "xunlei_pan",
    label: "迅雷网盘",
    passwordParam: "pwd",
    matchesHost: (host) => host === "pan.xunlei.com",
  },
  {
    provider: "pikpak",
    label: "PikPak",
    passwordParam: "passcode",
    matchesHost: (host) => host === "mypikpak.com",
  },
]
