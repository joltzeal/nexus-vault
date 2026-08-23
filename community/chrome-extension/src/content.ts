import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

import contentStyles from "./app/globals.css?inline"
import { ContentResourceDialog, type DialogMode } from "./content-dialog"

declare const __NEXUS_VAULT_ORIGIN__: string

const ACTION_MARKER = "data-nexus-vault-resource-action"
const PROCESSED_ANCHOR_MARKER = "data-nexus-vault-resource-anchor"
const PROCESSED_TEXT_MARKER = "data-nexus-vault-resource-text"
const TWEET_ACTION_MARKER = "data-nexus-vault-tweet-action"
const ROOT_CLASS = "nexus-vault-resource-root"
const SVG_NS = "http://www.w3.org/2000/svg"
const TWEET_SELECTOR = `article[data-testid="tweet"]`
const RESOURCE_SCAN_EXCLUDED_ORIGIN = __NEXUS_VAULT_ORIGIN__

type TransferTargetVault = {
  id: string
  title: string
  spaces: Array<{
    id: string
    name: string
    icon: string
  }>
}

type PreferredTarget = {
  vaultId: string
  spaceId: string
  vaultTitle: string
  spaceName: string
}

type AuthState = {
  connected: boolean
  checkedAt: string
  targets: TransferTargetVault[]
  preferredTarget?: PreferredTarget
}

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

type ExtensionRequest =
  | { type: "GET_AUTH_STATE"; refresh?: boolean }
  | { type: "OPEN_LOGIN" }
  | {
      type: "SAVE_RESOURCE"
      description?: string
      referer?: string
      title?: string
      url: string
      vaultId: string
      spaceId: string
    }
  | { type: "SET_PREFERRED_TARGET"; target: PreferredTarget }

type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; authRequired?: boolean }

let activeDialog: HTMLDivElement | undefined
let activeDialogRoot: Root | undefined
let activeDraft: ResourceDraft = emptyDraft()
let observer: MutationObserver | undefined
let scanQueued = false

injectStyles()
startObserver()
queueScan()

function startObserver() {
  observer = new MutationObserver(() => queueScan())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

function queueScan() {
  if (scanQueued) return
  scanQueued = true
  window.requestAnimationFrame(() => {
    scanQueued = false
    try {
      scanResourceLinks(document.body)
    } catch (error) {
      console.warn("Nexus Vault extension failed to scan resource links.", error)
    }
  })
}

function scanResourceLinks(root: HTMLElement | null) {
  if (!root || isResourceScanExcludedPage()) return
  withObserverPaused(() => {
    decorateTweetActions(root)
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      decorateAnchor(anchor)
    }
    decorateTextNodes(root)
  })
}

function decorateTweetActions(root: HTMLElement) {
  if (!isTwitterHost()) return

  for (const article of root.querySelectorAll<HTMLElement>(TWEET_SELECTOR)) {
    const tweetUrl = getTweetStatusUrlFromArticle(article)
    if (!tweetUrl) continue

    const bookmarkButton = article.querySelector<HTMLButtonElement>(`[data-testid="bookmark"]`)
    if (!bookmarkButton) continue

    if (article.querySelector(`[${TWEET_ACTION_MARKER}]`)) continue

    const bookmarkWrapper = bookmarkButton.parentElement
    const bookmarkRow = bookmarkWrapper?.parentElement
    if (!bookmarkWrapper || !bookmarkRow) continue

    const actionWrapper = createTweetActionWrapper(bookmarkWrapper, tweetUrl, bookmarkButton)
    bookmarkRow.insertBefore(actionWrapper, bookmarkWrapper)
  }
}

function decorateAnchor(anchor: HTMLAnchorElement) {
  if (anchor.dataset.nexusVaultResourceAnchor || shouldSkipNode(anchor)) return
  const resource = getDetectedResourceFromAnchor(anchor)
  if (!resource) return

  anchor.dataset.nexusVaultResourceAnchor = "true"
  anchor.insertAdjacentElement("beforebegin", createInlineResourceAction(resource))
}

function decorateTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT
      if (!node.parentElement || shouldSkipNode(node.parentElement)) {
        return NodeFilter.FILTER_REJECT
      }
      if (node.parentElement.closest("a[href]")) return NodeFilter.FILTER_REJECT
      return detectResourcesInText(node.textContent).length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })
  const nodes: Text[] = []
  while (nodes.length < 200) {
    const node = walker.nextNode()
    if (!node) break
    nodes.push(node as Text)
  }

  for (const node of nodes) decorateTextNode(node)
}

function decorateTextNode(node: Text) {
  const text = node.textContent ?? ""
  const matches = detectResourcesInText(text)
  if (matches.length === 0) return

  const fragment = document.createDocumentFragment()
  let cursor = 0
  for (const match of matches) {
    if (match.index < cursor) continue
    if (match.index > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)))

    const wrapper = document.createElement("span")
    wrapper.dataset.nexusVaultResourceText = "true"
    wrapper.className = ROOT_CLASS
    wrapper.appendChild(createInlineResourceAction(match.url))
    wrapper.appendChild(document.createTextNode(match.raw))
    fragment.appendChild(wrapper)
    cursor = match.index + match.raw.length
  }
  if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)))
  node.replaceWith(fragment)
}

function createInlineResourceAction(url: string) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "nexus-vault-resource-button"
  button.dataset.nexusVaultResourceAction = "true"
  button.dataset.nexusVaultResourceUrl = url
  button.setAttribute("aria-label", "添加到 Nexus Vault")
  button.setAttribute("title", "添加到 Nexus Vault")
  button.appendChild(createNexusIconSvg())
  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    void openResourceDialog(url)
  })
  return button
}

async function openTweetTargetDialog(url: string) {
  mountDialog("tweet", url)
}

function renderTweetTargetDialog(dialog: HTMLDivElement, state: AuthState, url: string) {
  const selected = findPreferredTarget(state.targets, state.preferredTarget)
  dialog.innerHTML = renderResourceSubmitShell(
    "选择 Space 后直接保存。",
    renderTweetTargetForm(state.targets, selected),
    "保存推文",
  )
  bindTweetTargetEvents(dialog, state, url)
}

function bindTweetTargetEvents(dialog: HTMLDivElement, state: AuthState, url: string) {
  dialog.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", closeDialog)
  dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", closeDialog)
  const form = dialog.querySelector<HTMLFormElement>("[data-tweet-target-form]")
  const vaultSelect = dialog.querySelector<HTMLSelectElement>("[data-resource-vault]")
  const spaceSelect = dialog.querySelector<HTMLSelectElement>("[data-resource-space]")

  vaultSelect?.addEventListener("change", () => {
    if (!vaultSelect || !spaceSelect) return
    const vault = state.targets.find((target) => target.id === vaultSelect.value)
    spaceSelect.innerHTML = renderSpaceOptions(vault?.spaces ?? [])
  })

  form?.addEventListener("submit", (event) => {
    event.preventDefault()
    const vaultId = vaultSelect?.value
    const spaceId = spaceSelect?.value
    if (!vaultId || !spaceId) {
      setDialogMessage(dialog, "请选择 Vault 和 Space。", "error")
      return
    }
    void saveTweetResource(dialog, state, {
      vaultId,
      spaceId,
      vaultTitle: state.targets.find((target) => target.id === vaultId)?.title ?? "Vault",
      spaceName:
        state.targets
          .find((target) => target.id === vaultId)
          ?.spaces.find((space) => space.id === spaceId)?.name ?? "Space",
    }, url)
  })
}

function createTweetActionWrapper(
  templateWrapper: HTMLElement,
  url: string,
  templateButton: HTMLButtonElement,
) {
  const wrapper = templateWrapper.cloneNode(false) as HTMLElement
  const button = templateButton.cloneNode(true) as HTMLButtonElement
  button.classList.add("nexus-vault-tweet-button")
  button.dataset.nexusVaultTweetAction = "true"
  button.setAttribute("aria-label", "添加到 Nexus Vault")
  button.setAttribute("title", "添加到 Nexus Vault")
  button.removeAttribute("data-testid")
  button.querySelector("svg")?.replaceWith(createNexusIconSvg())
  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    void openTweetTargetDialog(url)
  })
  wrapper.appendChild(button)
  return wrapper
}

function isTwitterHost() {
  const host = window.location.hostname.toLowerCase().replace(/^www\./, "")
  return host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com"
}

function findTweetActionGroup(article: HTMLElement) {
  const shareAction = article.querySelector<HTMLElement>(`[data-testid="share"]`)
  const shareGroup = shareAction?.closest<HTMLElement>(`[role="group"]`)
  if (shareGroup) return shareGroup

  const replyAction = article.querySelector<HTMLElement>(`[data-testid="reply"]`)
  const replyGroup = replyAction?.closest<HTMLElement>(`[role="group"]`)
  if (replyGroup) return replyGroup

  return article.querySelector<HTMLElement>(`[role="group"]`)
}

function getTweetStatusUrlFromArticle(article: HTMLElement) {
  for (const anchor of article.querySelectorAll<HTMLAnchorElement>(`a[href*="/status/"], a[href*="/statuses/"]`)) {
    const statusUrl = getTweetStatusUrl(anchor.getAttribute("href") ?? "")
    if (statusUrl) return statusUrl
  }
  return null
}

function getTweetStatusUrl(input: string) {
  let url: URL
  try {
    url = new URL(input, window.location.origin)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (host !== "x.com" && host !== "twitter.com" && host !== "mobile.twitter.com") return null

  const segments = url.pathname.split("/").filter(Boolean)
  const statusIndex = segments.findIndex((segment) =>
    segment.toLowerCase() === "status" || segment.toLowerCase() === "statuses"
  )
  const username = statusIndex > 0 ? segments[statusIndex - 1] : undefined
  const tweetId = segments[statusIndex + 1]
  if (!username || !tweetId || !/^\d+$/.test(tweetId)) return null

  return `https://x.com/${username}/status/${tweetId}`
}

async function openResourceDialog(url: string) {
  mountDialog("resource", url)
}

function renderResourceSubmitDialog(dialog: HTMLDivElement, state: AuthState) {
  const selected = findPreferredTarget(state.targets, state.preferredTarget)
  dialog.innerHTML = renderResourceSubmitShell(
    "添加链接后会自动补全展示信息。",
    renderResourceForm(state.targets, selected),
  )
  bindDialogEvents(dialog, state)
}

function bindDialogEvents(dialog: HTMLDivElement, state: AuthState) {
  dialog.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", closeDialog)
  dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.addEventListener("click", closeDialog)
  const form = dialog.querySelector<HTMLFormElement>("[data-resource-form]")
  const urlInput = dialog.querySelector<HTMLInputElement>("[data-resource-url]")
  const codeInput = dialog.querySelector<HTMLInputElement>("[data-resource-code]")
  const titleInput = dialog.querySelector<HTMLInputElement>("[data-resource-title]")
  const descriptionInput = dialog.querySelector<HTMLTextAreaElement>("[data-resource-description]")
  const refererInput = dialog.querySelector<HTMLInputElement>("[data-resource-referer]")
  const vaultSelect = dialog.querySelector<HTMLSelectElement>("[data-resource-vault]")
  const spaceSelect = dialog.querySelector<HTMLSelectElement>("[data-resource-space]")

  urlInput?.addEventListener("input", () => {
    activeDraft.url = urlInput.value
    const cloudDrive = parseCloudDriveLink(activeDraft.url)
    if (cloudDrive?.password && codeInput && !codeInput.value.trim()) {
      codeInput.value = cloudDrive.password
      activeDraft.extractionCode = cloudDrive.password
    }
  })
  codeInput?.addEventListener("input", () => {
    activeDraft.extractionCode = codeInput.value
  })
  titleInput?.addEventListener("input", () => {
    activeDraft.title = titleInput.value
  })
  descriptionInput?.addEventListener("input", () => {
    activeDraft.description = descriptionInput.value
  })
  refererInput?.addEventListener("input", () => {
    activeDraft.referer = refererInput.value
  })
  vaultSelect?.addEventListener("change", () => {
    if (!vaultSelect || !spaceSelect) return
    const vault = state.targets.find((target) => target.id === vaultSelect.value)
    spaceSelect.innerHTML = renderSpaceOptions(vault?.spaces ?? [])
  })
  form?.addEventListener("submit", (event) => {
    event.preventDefault()
    const vaultId = vaultSelect?.value
    const spaceId = spaceSelect?.value
    if (!vaultId || !spaceId) {
      setDialogMessage(dialog, "请选择 Vault 和 Space。", "error")
      return
    }
    void saveResource(dialog, state, {
      vaultId,
      spaceId,
      vaultTitle: state.targets.find((target) => target.id === vaultId)?.title ?? "Vault",
      spaceName:
        state.targets
          .find((target) => target.id === vaultId)
          ?.spaces.find((space) => space.id === spaceId)?.name ?? "Space",
    })
  })
}

async function saveResource(
  dialog: HTMLDivElement,
  state: AuthState,
  target: PreferredTarget,
) {
  const url = createCloudDriveUrlWithPassword(
    activeDraft.url.trim(),
    activeDraft.extractionCode.trim(),
  )
  if (!url) {
    setDialogMessage(dialog, "链接不能为空。", "error")
    return
  }

  setDialogBusy(dialog, true)
  const response = await sendMessage({
    type: "SAVE_RESOURCE",
    description: activeDraft.description,
    referer: activeDraft.referer,
    title: activeDraft.title,
    url,
    vaultId: target.vaultId,
    spaceId: target.spaceId,
  })

  if (!response.ok) {
    setDialogMessage(dialog, response.error, "error")
    setDialogBusy(dialog, false)
    return
  }

  await sendMessage({ type: "SET_PREFERRED_TARGET", target })
  state.preferredTarget = target
  setDialogMessage(dialog, `已保存到 ${target.vaultTitle} / ${target.spaceName}`, "success")
  window.setTimeout(closeDialog, 900)
}

async function saveTweetResource(
  dialog: HTMLDivElement,
  state: AuthState,
  target: PreferredTarget,
  url: string,
) {
  setDialogBusy(dialog, true)
  const response = await sendMessage({
    type: "SAVE_RESOURCE",
    description: "",
    referer: getCurrentReferer(),
    url,
    vaultId: target.vaultId,
    spaceId: target.spaceId,
  })

  if (!response.ok) {
    setDialogMessage(dialog, response.error, "error")
    setDialogBusy(dialog, false)
    return
  }

  await sendMessage({ type: "SET_PREFERRED_TARGET", target })
  state.preferredTarget = target
  setDialogMessage(dialog, `已保存到 ${target.vaultTitle} / ${target.spaceName}`, "success")
  window.setTimeout(closeDialog, 900)
}

function renderLogin(dialog: HTMLDivElement) {
  dialog.innerHTML = renderResourceSubmitShell(
    "需要授权登录",
    `<div class="nv-empty">
      <div>当前浏览器还没有 Nexus Vault 登录态。</div>
      <button class="nv-primary" data-login type="button">打开主页登录</button>
    </div>`,
  )
  dialog.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", closeDialog)
  dialog.querySelector<HTMLButtonElement>("[data-login]")?.addEventListener("click", () => {
    void sendMessage({ type: "OPEN_LOGIN" })
  })
}

function renderError(dialog: HTMLDivElement, message: string, authRequired = false) {
  if (authRequired) {
    renderLogin(dialog)
    return
  }

  dialog.innerHTML = renderResourceSubmitShell(
    "添加资源",
    `<div class="nv-empty nv-error">${escapeHtml(message)}</div>`,
  )
  dialog.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", closeDialog)
}

function renderResourceSubmitShell(description: string, body: string, title = "添加资源") {
  return `<section class="nv-dialog" role="dialog" aria-modal="true" aria-label="添加资源到 Nexus Vault">
    <header class="nv-dialog-header">
      <div class="nv-title-row">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        <button class="nv-icon-button" type="button" data-close aria-label="关闭">×</button>
      </div>
    </header>
    ${body}
    <div class="nv-status" data-status></div>
  </section>`
}

function renderResourceForm(
  targets: TransferTargetVault[],
  selected?: PreferredTarget,
) {
  const selectedVault =
    targets.find((target) => target.id === selected?.vaultId) ??
    targets.find((target) => target.spaces.length > 0)
  const selectedSpace =
    selectedVault?.spaces.find((space) => space.id === selected?.spaceId) ??
    selectedVault?.spaces[0]
  const cloudDrive = parseCloudDriveLink(activeDraft.url, activeDraft.extractionCode)

  return `<form class="nv-resource-form" data-resource-form>
    <div class="nv-field-group">
      <label class="nv-field">
        <span>链接（必填）</span>
        <input class="mono" data-resource-url placeholder="magnet:?xt=urn:btih:... 或 https://..." value="${escapeHtml(activeDraft.url)}" />
      </label>
      <label class="nv-field ${cloudDrive ? "" : "is-hidden"}">
        <span>${cloudDrive ? escapeHtml(getCloudDriveProviderLabel(cloudDrive.provider)) : "网盘"}提取码</span>
        <input class="mono" data-resource-code placeholder="没有提取码可留空" value="${escapeHtml(activeDraft.extractionCode)}" />
      </label>
      <label class="nv-field">
        <span>Vault</span>
        <select data-resource-vault>
          ${targets
            .map(
              (target) =>
                `<option value="${escapeHtml(target.id)}" ${target.id === selectedVault?.id ? "selected" : ""}>${escapeHtml(target.title)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="nv-field">
        <span>Space</span>
        <select data-resource-space>
          ${renderSpaceOptions(selectedVault?.spaces ?? [], selectedSpace?.id)}
        </select>
      </label>
      <label class="nv-field">
        <span>标题</span>
        <input data-resource-title placeholder="留空时由 metadata 管道补全" value="${escapeHtml(activeDraft.title)}" />
      </label>
      <label class="nv-field">
        <span>Referer</span>
        <input class="mono" data-resource-referer placeholder="可选，资源来源链接" value="${escapeHtml(activeDraft.referer)}" />
      </label>
      <label class="nv-field">
        <span>描述</span>
        <textarea data-resource-description placeholder="补充版本、来源或注意事项。">${escapeHtml(activeDraft.description)}</textarea>
      </label>
    </div>
    <footer class="nv-dialog-footer">
      <button class="nv-secondary" type="button" data-cancel>取消</button>
      <button class="nv-primary" type="submit" data-submit ${activeDraft.url.trim() ? "" : "disabled"}>添加</button>
    </footer>
  </form>`
}

function renderTweetTargetForm(
  targets: TransferTargetVault[],
  selected?: PreferredTarget,
) {
  const selectedVault =
    targets.find((target) => target.id === selected?.vaultId) ??
    targets.find((target) => target.spaces.length > 0)
  const selectedSpace =
    selectedVault?.spaces.find((space) => space.id === selected?.spaceId) ??
    selectedVault?.spaces[0]

  return `<form class="nv-resource-form" data-tweet-target-form>
    <div class="nv-field-group">
      <label class="nv-field">
        <span>Vault</span>
        <select data-resource-vault>
          ${targets
            .map(
              (target) =>
                `<option value="${escapeHtml(target.id)}" ${target.id === selectedVault?.id ? "selected" : ""}>${escapeHtml(target.title)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label class="nv-field">
        <span>Space</span>
        <select data-resource-space>
          ${renderSpaceOptions(selectedVault?.spaces ?? [], selectedSpace?.id)}
        </select>
      </label>
    </div>
    <footer class="nv-dialog-footer">
      <button class="nv-secondary" type="button" data-cancel>取消</button>
      <button class="nv-primary" type="submit" data-submit>保存</button>
    </footer>
  </form>`
}

function renderSpaceOptions(spaces: TransferTargetVault["spaces"], selectedSpaceId?: string) {
  return spaces
    .map(
      (space) =>
        `<option value="${escapeHtml(space.id)}" ${space.id === selectedSpaceId ? "selected" : ""}>${escapeHtml(space.name)}</option>`,
    )
    .join("")
}

function setDialogBusy(dialog: HTMLDivElement, busy: boolean) {
  const submit = dialog.querySelector<HTMLButtonElement>("[data-submit]")
  if (!submit) return
  if (!submit.dataset.idleLabel) {
    submit.dataset.idleLabel = submit.textContent?.trim() || "添加"
  }
  const idleLabel = submit.dataset.idleLabel
  submit.disabled = busy
  submit.textContent = busy ? `${idleLabel}中` : idleLabel
}

function setDialogMessage(dialog: HTMLDivElement, message: string, tone: "success" | "error" | "muted") {
  const status = dialog.querySelector<HTMLElement>("[data-status]")
  if (!status) return
  status.className = `nv-status ${tone}`
  status.textContent = message
}

function closeDialog() {
  activeDialogRoot?.unmount()
  activeDialogRoot = undefined
  activeDialog?.remove()
  activeDialog = undefined
}

function mountDialog(mode: DialogMode, url: string) {
  closeDialog()

  const host = document.createElement("div")
  host.className = "nexus-vault-dialog-root"
  document.body.appendChild(host)
  activeDialog = host

  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = `
    ${contentStyles}
    :host {
      color-scheme: dark;
      --ink-900: #0c1116;
      --ink-850: #0f161d;
      --ink-800: #131c24;
      --ink-750: #18222c;
      --ink-700: #1f2c38;
      --line: #1b2731;
      --line-soft: #16212a;
      --fg: #e6edf3;
      --fg-muted: #9bb0c0;
      --fg-dim: #5f7585;
      --fg-faint: #3f5260;
      --jade: #3fd8b0;
      --jade-bright: #5ff0c8;
      --jade-dim: #1f3d37;
      --jade-glow: rgba(63, 216, 176, 0.14);
      --jade-ink: #04140f;
      --amber: #e8b34a;
      --rose: #f0697a;
      --violet: #9b8cff;
      --sky: #5cb9f0;
      --background: var(--ink-900);
      --foreground: var(--fg);
      --card: var(--ink-800);
      --card-foreground: var(--fg);
      --popover: var(--ink-850);
      --popover-foreground: var(--fg);
      --primary: var(--jade);
      --primary-foreground: var(--jade-ink);
      --secondary: var(--ink-800);
      --secondary-foreground: var(--fg);
      --muted: var(--ink-800);
      --muted-foreground: var(--fg-dim);
      --accent: var(--ink-750);
      --accent-foreground: var(--fg);
      --destructive: var(--rose);
      --destructive-foreground: var(--fg);
      --border: var(--line);
      --input: var(--line);
      --ring: var(--jade-dim);
      --radius: 6px;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .nexus-vault-extension-scope, .nexus-vault-extension-scope * {
      box-sizing: border-box;
    }
    .nexus-vault-extension-scope {
      position: fixed;
      inset: 0;
    }
  `
  shadow.appendChild(style)
  const mount = document.createElement("div")
  shadow.appendChild(mount)
  activeDialogRoot = createRoot(mount)
  activeDialogRoot.render(
    createElement(ContentResourceDialog, {
      mode,
      onClose: closeDialog,
      referer: getCurrentReferer(),
      url,
    }),
  )
}

function sendMessage<T = unknown>(message: ExtensionRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse<T>>
}

function detectResourcesInText(text: string) {
  const candidates: Array<{ index: number; raw: string; url: string }> = []
  const pattern = /(?:magnet:\?[^\s<>"'，。！？、]+|ed2k:\/\/[^\s<>"'，。！？、]+|thunder:\/\/[^\s<>"'，。！？、]+|ftp:\/\/[^\s<>"'，。！？、]+|https?:\/\/(?:www\.)?(?:pan\.baidu\.com|115cdn\.com|123\d{3}\.com|pan\.quark\.cn|drive\.uc\.cn|pan\.xunlei\.com|mypikpak\.com)[^\s<>"'，。！？、]*)/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const raw = trimUrlPunctuation(match[0])
    const detected = detectResourceUrl(raw)
    if (!detected) continue
    candidates.push({
      index: match.index,
      raw,
      url: detected,
    })
  }
  return candidates
}

function getDetectedResourceFromAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href") ?? ""
  const text = anchor.textContent?.trim() ?? ""
  return detectResourceUrl(href) ?? detectResourceUrl(text)
}

function detectResourceUrl(value: string) {
  const url = normalizeResourceInputUrl(value)
  if (!url) return null
  if (parseMagnetLink(url)) return url
  if (parseEd2kLink(url)) return url
  if (parseThunderLink(url)) return url
  if (parseFtpLink(url)) return url
  if (parseCloudDriveLink(url)) return url
  return null
}

function parseMagnetLink(url: string) {
  const value = url.trim()
  if (/^[a-fA-F0-9]{40}$/.test(value)) return `magnet:?xt=urn:btih:${value.toUpperCase()}`
  if (!value.toLowerCase().startsWith("magnet:?")) return null
  const query = value.slice(value.indexOf("?") + 1)
  const params = new URLSearchParams(query)
  const btih = params
    .getAll("xt")
    .map((xt) => xt.match(/^urn:btih:([a-zA-Z0-9]{32,40})$/i)?.[1])
    .find((hash): hash is string => Boolean(hash))
  return btih ? value : null
}

function parseEd2kLink(url: string) {
  return url.trim().toLowerCase().startsWith("ed2k://")
}

function parseThunderLink(url: string) {
  const value = url.trim()
  if (!value.toLowerCase().startsWith("thunder://")) return false

  const payload = value.slice("thunder://".length).replace(/[?#].*$/, "")
  const decoded = decodeThunderPayload(payload)
  return Boolean(decoded && stripThunderAffixes(decoded.trim()))
}

function decodeThunderPayload(value: string) {
  const normalized = normalizeBase64(value)

  try {
    return window.atob(normalized)
  } catch {
    return null
  }
}

function normalizeBase64(value: string) {
  const decodedValue = decodeLinkPart(value).replace(/-/g, "+").replace(/_/g, "/")
  const padding = decodedValue.length % 4
  return padding === 0
    ? decodedValue
    : decodedValue.padEnd(decodedValue.length + (4 - padding), "=")
}

function stripThunderAffixes(value: string) {
  return value.replace(/^AA/i, "").replace(/ZZ$/i, "")
}

function decodeLinkPart(value: string) {
  const normalized = value.replace(/\+/g, "%20")

  try {
    return decodeURIComponent(normalized)
  } catch {
    return value
  }
}

function parseFtpLink(url: string) {
  try {
    return new URL(url.trim()).protocol.toLowerCase() === "ftp:"
  } catch {
    return false
  }
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

function normalizeResourceInputUrl(value: string) {
  const trimmed = trimUrlPunctuation(value.trim())
  const match = trimmed.match(/https?:\/\/[^\s<>"'，。！？、]+/i)
  return match ? trimUrlPunctuation(match[0]) : trimmed
}

function trimUrlPunctuation(value: string) {
  return value.replace(/[),.;!?，。！？、]+$/g, "")
}

function shouldSkipNode(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  if (!element) return true
  if (element.closest(`.${ROOT_CLASS}, .nexus-vault-dialog-root, [${ACTION_MARKER}], [${PROCESSED_TEXT_MARKER}]`)) {
    return true
  }
  return Boolean(
    element.closest(
      "script, style, textarea, input, select, option, button, svg, canvas, pre, code, [contenteditable='true']",
    ),
  )
}

function isResourceScanExcludedPage() {
  try {
    return window.location.origin === new URL(RESOURCE_SCAN_EXCLUDED_ORIGIN).origin
  } catch {
    return false
  }
}

function getCurrentReferer() {
  return window.location.href
}

function withObserverPaused(callback: () => void) {
  observer?.disconnect()
  try {
    callback()
  } finally {
    startObserver()
  }
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

function emptyDraft(): ResourceDraft {
  return {
    description: "",
    extractionCode: "",
    referer: getCurrentReferer(),
    title: "",
    url: "",
  }
}

function createNexusIconSvg() {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("viewBox", "0 0 512 512")
  svg.setAttribute("width", "512")
  svg.setAttribute("height", "512")
  svg.setAttribute("xmlns", SVG_NS)
  svg.setAttribute("aria-hidden", "true")
  svg.appendChild(createNexusIconDefs())
  svg.appendChild(createNexusIconBackground())
  svg.appendChild(createNexusIconText())
  return svg
}

function createNexusIconDefs() {
  const defs = document.createElementNS(SVG_NS, "defs")
  const gradient = document.createElementNS(SVG_NS, "linearGradient")
  gradient.setAttribute("id", "bg512")
  gradient.setAttribute("x1", "0")
  gradient.setAttribute("y1", "0")
  gradient.setAttribute("x2", "1")
  gradient.setAttribute("y2", "1")
  gradient.appendChild(createGradientStop("0", "#3fd8b0"))
  gradient.appendChild(createGradientStop(".55", "#1f9e7d"))
  gradient.appendChild(createGradientStop("1", "#0a5f4a"))
  defs.appendChild(gradient)
  return defs
}

function createGradientStop(offset: string, color: string) {
  const stop = document.createElementNS(SVG_NS, "stop")
  stop.setAttribute("offset", offset)
  stop.setAttribute("stop-color", color)
  return stop
}

function createNexusIconBackground() {
  const rect = document.createElementNS(SVG_NS, "rect")
  rect.setAttribute("width", "512")
  rect.setAttribute("height", "512")
  rect.setAttribute("rx", "118")
  rect.setAttribute("fill", "url(#bg512)")
  return rect
}

function createNexusIconText() {
  const text = document.createElementNS(SVG_NS, "text")
  text.setAttribute("x", "256")
  text.setAttribute("y", "380")
  text.setAttribute("text-anchor", "middle")
  text.setAttribute(
    "font-family",
    "'SF Mono','SFMono-Regular','JetBrains Mono','Menlo','Consolas','Liberation Mono',monospace",
  )
  text.setAttribute("font-size", "400")
  text.setAttribute("font-weight", "700")
  text.setAttribute("fill", "#ffffff")
  text.textContent = "N"
  return text
}

function getSpaceIcon(icon: string) {
  if (icon === "film") return "FM"
  if (icon === "book") return "BK"
  if (icon === "music") return "MS"
  if (icon === "image") return "IM"
  if (icon === "code") return "CD"
  if (icon === "download") return "DL"
  return "SP"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function injectStyles() {
  if (document.getElementById("nexus-vault-extension-styles")) return

  const style = document.createElement("style")
  style.id = "nexus-vault-extension-styles"
  style.textContent = `
    .${ROOT_CLASS} {
      align-items: baseline;
      display: inline;
      white-space: inherit;
    }
    .nexus-vault-resource-button {
      align-items: center;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      height: 1em;
      line-height: 1;
      margin: 0 .22em 0 0;
      padding: 0;
      vertical-align: -0.12em;
      width: 1em;
    }
    .nexus-vault-resource-button svg {
      border-radius: .18em;
      display: block;
      height: 1em;
      width: 1em;
    }
    .nexus-vault-resource-button:hover svg {
      filter: brightness(1.08);
    }
    .nexus-vault-tweet-button {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      display: inline-flex;
      flex: 0 0 auto;
      height: 34.75px;
      justify-content: center;
      padding: 0;
      width: 34.75px;
    }
    .nexus-vault-tweet-button:hover {
      background: rgba(63, 216, 176, 0.12);
    }
    .nexus-vault-tweet-button svg {
      border-radius: 4px;
      display: block;
      height: 18.75px;
      width: 18.75px;
    }
    .nexus-vault-dialog-root {
      align-items: center;
      background: rgba(4, 8, 11, 0.58);
      color: #e6edf3;
      display: flex;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      inset: 0;
      justify-content: center;
      padding: 16px;
      position: fixed;
      z-index: 2147483647;
    }
    .nv-dialog {
      background: #0f161d;
      border: 1px solid #1b2731;
      border-radius: 8px;
      box-shadow: 0 18px 55px -20px rgba(0, 0, 0, 0.86);
      max-height: min(720px, calc(100dvh - 2rem));
      overflow: hidden;
      width: min(520px, calc(100vw - 2rem));
    }
    .nv-dialog,
    .nv-dialog * {
      box-sizing: border-box;
    }
    .nv-dialog-header {
      border-bottom: 1px solid #1b2731;
      padding: 12px 16px;
    }
    .nv-title-row {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      min-width: 0;
    }
    .nv-title-row h2 {
      color: #e6edf3;
      font-size: 16px;
      font-weight: 650;
      letter-spacing: 0;
      line-height: 22px;
      margin: 0;
    }
    .nv-title-row p {
      color: #5f7585;
      font-size: 13px;
      line-height: 20px;
      margin: 2px 0 0;
    }
    .nv-icon-button {
      background: transparent;
      border: 0;
      border-radius: 6px;
      color: #9bb0c0;
      cursor: pointer;
      font-size: 22px;
      height: 28px;
      line-height: 1;
      width: 28px;
    }
    .nv-icon-button:hover {
      background: #131c24;
      color: #3fd8b0;
    }
    .nv-resource-form {
      display: flex;
      flex-direction: column;
      max-height: calc(100dvh - 7rem);
      min-height: 0;
    }
    .nv-field-group {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 16px;
    }
    .nv-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .nv-field.is-hidden {
      display: none;
    }
    .nv-field span {
      color: #9bb0c0;
      font-size: 12px;
      font-weight: 600;
    }
    .nv-field input,
    .nv-field select,
    .nv-field textarea {
      background: #0c1116;
      border: 1px solid #16212a;
      border-radius: 6px;
      color: #e6edf3;
      font: inherit;
      font-size: 13px;
      min-height: 34px;
      outline: none;
      padding: 7px 9px;
      width: 100%;
    }
    .nv-field textarea {
      min-height: 132px;
      resize: vertical;
    }
    .nv-field input:focus,
    .nv-field select:focus,
    .nv-field textarea:focus {
      border-color: #1f3d37;
      box-shadow: 0 0 0 3px rgba(63, 216, 176, 0.14);
    }
    .mono {
      font-family: "SFMono-Regular", ui-monospace, monospace;
      letter-spacing: 0;
    }
    .nv-dialog-footer {
      align-items: center;
      border-top: 1px solid #16212a;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 16px;
    }
    .nv-primary,
    .nv-secondary {
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 650;
      height: 32px;
      padding: 0 12px;
    }
    .nv-primary {
      background: #3fd8b0;
      border: 0;
      color: #04140f;
    }
    .nv-primary:hover {
      background: #5ff0c8;
    }
    .nv-primary:disabled {
      cursor: default;
      opacity: .65;
    }
    .nv-secondary {
      background: transparent;
      border: 1px solid #1b2731;
      color: #e6edf3;
    }
    .nv-secondary:hover {
      background: #131c24;
    }
    .nv-empty {
      align-items: center;
      border: 1px dashed #1b2731;
      border-radius: 6px;
      color: #5f7585;
      display: flex;
      flex-direction: column;
      gap: 12px;
      justify-content: center;
      margin: 14px 16px;
      min-height: 128px;
      padding: 16px;
      text-align: center;
    }
    .nv-error {
      color: #f0697a;
    }
    .nv-status {
      border-top: 1px solid #16212a;
      color: #5f7585;
      font-size: 12px;
      min-height: 34px;
      padding: 8px 12px;
    }
    .nv-status.success {
      color: #3fd8b0;
    }
    .nv-status.error {
      color: #f0697a;
    }
  `
  document.documentElement.appendChild(style)
}
