"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { authClient } from "@/lib/auth-client"
import {
  createCloudDriveUrlWithPassword,
  parseResourceInput,
} from "@/domain/resources/input"
import { toast } from "@/lib/toast"
import { Progress } from "@/components/ui/progress"

import { apiRequest } from "@/features/api-client"
import { uploadLocalMediaMultipart } from "@/features/local-media-multipart"
import { getVaultAccess, getWorkspaceViewer } from "@/features/dashboard-access"
import {
  AuthDialog,
  CreateResourceDialog,
  CreateSetDialog,
  CreateSpaceDialog,
  createVideoThumbnail,
} from "@/features/components/vault-dialogs"
import {
  ResourceDetailsSheet,
  type ResourceDetailsForm,
} from "@/features/components/resource-details-sheet"
import { ShareSubmissionDialog } from "@/features/components/share-submission-dialog"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { StarPage } from "@/features/components/star-page"
import {
  VaultDocument,
  type VaultDocumentSearchTarget,
} from "@/features/components/vault-document"
import {
  type CollaboratorItem,
  type NotificationItem,
  type SettingsTab,
  type ShareSettings,
  type StarredVaultItem,
  VaultSettingsSheet,
} from "@/features/components/vault-settings-sheet"
import { VaultSidebar } from "@/features/components/vault-sidebar"
import {
  VaultTopbar,
  type VaultTopbarPage,
  type VaultSearchItem,
} from "@/features/components/vault-topbar"
import { WatchLaterPage } from "@/features/components/watch-later-page"
import { mapVaultDetail, mapVaultListItem } from "@/features/mappers"
import {
  emptyResourceForm,
  emptySetForm,
  emptySpaceForm,
  emptyAuthForm,
  type AuthForm,
  type AuthMode,
  type ReadLaterResourceItem,
  type Resource,
  type ResourceAnnotation,
  type ResourceAnnotationPatch,
  type ResourceMetadataEnvelope,
  type ResourceSubmissionItem,
  type ResourceSet,
  type Space,
  type StarredResourceItem,
  type ResourceTransferTargetVault,
  type VaultWorkspaceInitialData,
  type Visibility,
} from "@/features/types"
import { useRouter } from "@/lib/router"

type AuthPolicy = {
  allowSignUp: boolean
  reason: "public-registration" | "first-user" | "disabled"
}

type VaultAlerts = {
  notifications: NotificationItem[]
  pendingSubmissions: ResourceSubmissionItem[]
  unreadNotificationCount: number
}

type ResourceMetadataStatusItem = {
  id: string
  title: string
  description: string
  metadataStatus: Resource["metadataStatus"]
  metadata?: ResourceMetadataEnvelope | null
}

type LocalMediaUpload = {
  completedBytes: number
  phase: "preparing" | "uploading" | "syncing"
  resourceId: string
  totalBytes: number
}

function MediaUploadProgress({
  count,
  phase,
  progress,
}: {
  count: number
  phase: LocalMediaUpload["phase"]
  progress: number
}) {
  const phaseLabel =
    phase === "preparing"
      ? "正在准备视频预览图"
      : phase === "syncing"
        ? "上传完成，正在同步资源"
        : "正在上传，可继续浏览其他资源"

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{phaseLabel}</span>
        <span className="shrink-0 tabular-nums">{progress}%</span>
      </div>
      <Progress
        aria-label={`${count} 个媒体资源上传进度`}
        className="gap-0 [&_[data-slot=progress-track]]:bg-ink-700 [&_[data-slot=progress-indicator]]:bg-jade"
        value={progress}
      />
    </div>
  )
}

const LOCAL_NSFW_STORAGE_KEY = "nexus-vault:nsfw-enabled"

function getDashboardVaultPath(vaultId?: string) {
  return vaultId ? `/dashboard/${encodeURIComponent(vaultId)}` : "/dashboard"
}

export function VaultWorkspaceClient({
  initialData,
}: {
  initialData: VaultWorkspaceInitialData
}) {
  const router = useRouter()
  const [sets, setSets] = useState<ResourceSet[]>(initialData.sets)
  const [externalActiveSet, setExternalActiveSet] = useState<ResourceSet | null>(
    initialData.externalActiveSet ?? null,
  )
  const [activeSetId, setActiveSetId] = useState(initialData.activeSetId)
  const [activePage, setActivePage] = useState<VaultTopbarPage>(() => {
    if (initialData.mode === "share") return "workspace"
    if (typeof window === "undefined") return "workspace"
    const page = new URLSearchParams(window.location.search).get("page")
    return page === "star" || page === "watch-later" ? page : "workspace"
  })
  const [setDialogOpen, setSetDialogOpen] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authPolicy, setAuthPolicy] = useState<AuthPolicy>({
    allowSignUp: false,
    reason: "disabled",
  })
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in")
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm)
  const [authError, setAuthError] = useState("")
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false)
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const [resourceDetailsOpen, setResourceDetailsOpen] = useState(false)
  const [loadingVaultId, setLoadingVaultId] = useState("")
  const [selectedResourceId, setSelectedResourceId] = useState(
    initialData.sets.find((set) => set.id === initialData.activeSetId)?.resources[0]?.id ??
      initialData.externalActiveSet?.resources[0]?.id ??
      ""
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isImportingVault, setIsImportingVault] = useState(false)
  const [isSavingVault, setIsSavingVault] = useState(false)
  const [apiError, setApiError] = useState(initialData.error ?? "")
  const [setForm, setSetForm] = useState(emptySetForm)
  const [setDialogMode, setSetDialogMode] = useState<"create" | "edit">("create")
  const [spaceForm, setSpaceForm] = useState(emptySpaceForm)
  const [spaceDialogVaultId, setSpaceDialogVaultId] = useState("")
  const [editingSpaceId, setEditingSpaceId] = useState("")
  const [resourceForm, setResourceForm] = useState(emptyResourceForm)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("share")
  const [share, setShare] = useState<ShareSettings>({ visibility: "private" })
  const [sharePassword, setSharePassword] = useState("")
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [starredVaults, setStarredVaults] = useState<StarredVaultItem[]>([])
  const [starredResources, setStarredResources] = useState<StarredResourceItem[]>([])
  const [readLaterResources, setReadLaterResources] = useState<ReadLaterResourceItem[]>([])
  const [submissions, setSubmissions] = useState<ResourceSubmissionItem[]>([])
  const [transferTargets, setTransferTargets] = useState<ResourceTransferTargetVault[]>([])
  const [transferFocusSpaceId, setTransferFocusSpaceId] = useState("")
  const [workspaceSearchTarget, setWorkspaceSearchTarget] =
    useState<VaultDocumentSearchTarget>()
  const [localNsfwEnabled, setLocalNsfwEnabled] = useState<boolean | null>(null)
  const [isResourceSubmitting, setIsResourceSubmitting] = useState(false)
  const [localMediaUploadResourceIds, setLocalMediaUploadResourceIds] = useState<string[]>([])
  const [localMediaUploads, setLocalMediaUploads] = useState<LocalMediaUpload[]>([])
  const toastedMetadataFailureIds = useRef<Set<string>>(new Set())
  const metadataRefreshInFlight = useRef(false)
  const createResourceInFlight = useRef(false)
  const localMediaUploadInFlight = useRef(new Set<string>())
  const importVaultInFlight = useRef(false)
  const saveVaultInFlight = useRef(false)
  const vaultLoadRequestId = useRef(0)
  const searchTargetRequestId = useRef(0)

  const currentUser = getWorkspaceViewer(initialData)
  const currentUserId = currentUser?.id
  const currentUserName = currentUser?.name ?? ""
  const ownedActiveSet = sets.find((set) => set.id === activeSetId)
  const activeSet =
    ownedActiveSet ??
    (externalActiveSet?.id === activeSetId ? externalActiveSet : null) ??
    sets[0]
  const isShareMode = initialData.mode === "share"
  const allowResourceMediaUpload =
    initialData.allowResourceMediaUpload === true && !isShareMode
  const mediaVisible = activeSet
    ? localNsfwEnabled === null
      ? !activeSet.nsfwEnabled
      : !localNsfwEnabled
    : true
  const resolvingResourceIds =
    activeSet?.resources
      .filter(
        (resource) =>
          resource.metadataStatus === "pending" ||
          resource.metadataStatus === "processing" ||
          isResourceAiSummaryResolving(resource)
      )
      .map((resource) => resource.id)
      .join("|") ?? ""
  const hasResolvingAiSummary =
    activeSet?.resources.some(isResourceAiSummaryResolving) ?? false

  const filteredResources = useMemo(() => {
    return activeSet?.resources ?? []
  }, [activeSet])

  const visibleActiveSet = useMemo(
    () =>
      activeSet
        ? {
            ...activeSet,
            resources: filteredResources,
          }
        : undefined,
    [activeSet, filteredResources]
  )
  const localMediaUploadSummary = useMemo(() => {
    const totalBytes = localMediaUploads.reduce((sum, upload) => sum + upload.totalBytes, 0)
    const completedBytes = localMediaUploads.reduce(
      (sum, upload) => sum + Math.min(upload.completedBytes, upload.totalBytes),
      0
    )
    const progress = totalBytes > 0 ? Math.floor((completedBytes / totalBytes) * 100) : 0
    const phase: LocalMediaUpload["phase"] = localMediaUploads.some((upload) => upload.phase === "uploading")
      ? "uploading"
      : localMediaUploads.some((upload) => upload.phase === "preparing")
        ? "preparing"
        : "syncing"

    return { count: localMediaUploads.length, phase, progress }
  }, [localMediaUploads])

  useEffect(() => {
    const toastId = "local-media-uploads"
    if (localMediaUploadSummary.count === 0) {
      toast.dismiss(toastId)
      return
    }

    toast.info(
      localMediaUploadSummary.count === 1 ? "正在上传媒体" : `正在上传 ${localMediaUploadSummary.count} 个媒体资源`,
      {
        id: toastId,
        description: (
          <MediaUploadProgress
            count={localMediaUploadSummary.count}
            phase={localMediaUploadSummary.phase}
            progress={localMediaUploadSummary.progress}
          />
        ),
        duration: 0,
      }
    )
  }, [localMediaUploadSummary])
  const currentVaultSearchItems = useMemo(
    () => getCurrentVaultSearchItems(activeSet),
    [activeSet],
  )
  const globalSearchItems = useMemo(
    () => getGlobalSearchItems(sets, starredVaults, externalActiveSet),
    [externalActiveSet, sets, starredVaults],
  )

  const selectedResource =
    activeSet?.resources.find((resource) => resource.id === selectedResourceId)
  const vaultAccess = getVaultAccess({
    activeSet,
    currentUserId,
    selectedResource,
  })
  const { isVaultOwner, isVaultEditor, canAddResource } = vaultAccess
  const spaceDialogVaultTitle =
    spaceDialogVaultId === activeSet?.id
      ? activeSet?.name
      : transferTargets.find((target) => target.id === spaceDialogVaultId)?.title
  const canEditSelectedResource = vaultAccess.canEditResource
  const currentUserImage = currentUser?.image ?? undefined

  useEffect(() => {
    document.title = activeSet?.name ? `${activeSet.name} · NexusVault` : "NexusVault"
  }, [activeSet?.name])

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(LOCAL_NSFW_STORAGE_KEY)
      if (value === "true") setLocalNsfwEnabled(true)
      else if (value === "false") setLocalNsfwEnabled(false)
      else setLocalNsfwEnabled(null)
    } catch (error) {
      console.warn("Failed to read local NSFW preference.", error)
      setLocalNsfwEnabled(null)
    }
  }, [])

  useEffect(() => {
    if (!activeSet) return

    for (const resource of activeSet.resources) {
      if (resource.metadataStatus !== "failed") continue
      if (toastedMetadataFailureIds.current.has(resource.id)) continue

      toastedMetadataFailureIds.current.add(resource.id)
      toast.error(`资源 metadata 处理失败：${resource.title}`, {
        id: `metadata-failed-${resource.id}`,
        description: resource.metadata?.errorMessage ?? undefined,
      })
    }
  }, [activeSet])

  useEffect(() => {
    if (!apiError) return

    toast.error(apiError, {
      id: "vault-workspace-api-error",
      duration: 4200,
    })
    const timeout = window.setTimeout(() => setApiError(""), 4300)

    return () => window.clearTimeout(timeout)
  }, [apiError])

  useEffect(() => {
    if (currentUser) return

    void loadAuthPolicy()
  }, [currentUser?.email])

  useEffect(() => {
    if (!currentUser || !activeSet?.id) {
      setShare({ visibility: activeSet?.visibility ?? "private" })
      setCollaborators([])
      setNotifications([])
      setUnreadNotificationCount(0)
      setStarredVaults([])
      setStarredResources([])
      setReadLaterResources([])
      setSubmissions([])
      return
    }

    void loadVaultPanels(activeSet.id, {
      includeAlerts: isVaultOwner,
      includeSettings: false,
      includeStarredResources: activePage === "star",
    })
  }, [activePage, activeSet?.id, currentUser?.email, isVaultOwner])

  useEffect(() => {
    if (!currentUser || activePage !== "watch-later") return
    void loadReadLaterResources()
  }, [activePage, currentUser?.email])

  useEffect(() => {
    if (!currentUser || !activeSet?.id || !isVaultOwner) return

    const intervalId = window.setInterval(() => {
      if (document.hidden) return
      void refreshVaultAlerts(activeSet.id)
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [activeSet?.id, currentUser?.email, isVaultOwner])

  useEffect(() => {
    if (!activeSet?.id || !resolvingResourceIds) return

    const refreshResolvingResources = () => {
      if (document.hidden) return
      if (metadataRefreshInFlight.current) return
      metadataRefreshInFlight.current = true
      const resourceIds = resolvingResourceIds.split("|").filter(Boolean)
      void refreshVaultMetadataStatuses(activeSet.id, resourceIds)
        .catch((error: unknown) => {
          console.warn("Failed to refresh resource metadata statuses.", error)
        })
        .finally(() => {
          metadataRefreshInFlight.current = false
        })
    }

    const timeoutId = window.setTimeout(refreshResolvingResources, 300)
    const intervalId = window.setInterval(
      refreshResolvingResources,
      hasResolvingAiSummary ? 1500 : 2000,
    )

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [activeSet?.id, hasResolvingAiSummary, resolvingResourceIds])

  async function loadVaults(
    nextActiveSetId?: string,
    options: {
      includeOpenedVaultInList?: boolean
      silent?: boolean
      suppressErrors?: boolean
    } = {}
  ): Promise<boolean> {
    const requestId = ++vaultLoadRequestId.current
    const includeOpenedVaultInList = options.includeOpenedVaultInList ?? true
    const shouldSwitchImmediately = Boolean(
      !options.silent && nextActiveSetId && nextActiveSetId !== activeSetId
    )
    if (!options.silent) {
      setIsLoading(true)
      if (shouldSwitchImmediately && nextActiveSetId) {
        setActiveSetId(nextActiveSetId)
        setSelectedResourceId("")
        setResourceDetailsOpen(false)
        setLoadingVaultId(nextActiveSetId)
      }
    }
    setApiError("")

    try {
      const data = await apiRequest<{
        items: Array<{
          id: string
          title: string
          description: string
          cover: string
          visibility: Visibility
          collectionEnabled: boolean
          nsfwEnabled: boolean
          ownerName: string | null
          ownerId: string | null
          starCount: number
          forkCount: number
          resourceCount: number
          createdAt: string
          actorRole?: "owner" | "editor" | "anonymous"
        }>
      }>("/vaults")
      if (requestId !== vaultLoadRequestId.current) return false

      const listItems = data.items.map(mapVaultListItem)
      const targetId =
        nextActiveSetId
          ? nextActiveSetId
          : listItems.some((set) => set.id === activeSetId)
            ? activeSetId
            : listItems[0]?.id

      if (!targetId) {
        setSets([])
        setExternalActiveSet(null)
        setActiveSetId("")
        setSelectedResourceId("")
        setLoadingVaultId("")
        return true
      }

      if (!options.silent && !nextActiveSetId && targetId !== activeSetId) {
        setActiveSetId(targetId)
        setSelectedResourceId("")
        setResourceDetailsOpen(false)
        setLoadingVaultId(targetId)
      }

      const detail = await apiRequest<{
        vault: {
          id: string
          title: string
          description: string
          cover: string
          ownerName: string | null
          ownerId: string | null
          visibility: Visibility
          collectionEnabled: boolean
          nsfwEnabled: boolean
          starCount: number
          forkCount: number
          createdAt: string
        }
        actorRole?: "owner" | "editor" | "anonymous"
        spaces: Space[]
        resources: Array<Resource & { spaceId: string | null }>
      }>(`/vaults/${targetId}`)
      if (requestId !== vaultLoadRequestId.current) return false

      const hydratedSet = {
        ...mapVaultDetail(detail),
        isStarred: starredVaults.some((vault) => vault.id === detail.vault.id),
      }

      if (includeOpenedVaultInList) {
        setExternalActiveSet(null)
        setSets((currentSets) =>
          markStarredSets(
            mergeVaultListWithExisting(listItems, currentSets, hydratedSet),
            starredVaults
          )
        )
      } else {
        setExternalActiveSet(hydratedSet)
        setSets((currentSets) =>
          markStarredSets(mergeVaultListWithExisting(listItems, currentSets), starredVaults)
        )
      }
      setActiveSetId(hydratedSet.id)
      if (!isShareMode) {
        window.history.replaceState(null, "", getDashboardVaultPath(hydratedSet.id))
      }
      setSelectedResourceId((currentResourceId) =>
        hydratedSet.resources.some((resource) => resource.id === currentResourceId)
          ? currentResourceId
          : hydratedSet.resources[0]?.id ?? ""
      )
      setLoadingVaultId("")
      return true
    } catch (error) {
      if (requestId !== vaultLoadRequestId.current) return false
      if (!options.suppressErrors) {
        setApiError(error instanceof Error ? error.message : "API request failed.")
      }
      return false
    } finally {
      if (requestId === vaultLoadRequestId.current && !options.silent) {
        setIsLoading(false)
        setLoadingVaultId("")
      }
    }
  }

  async function refreshVaultDetail(vaultId: string) {
    try {
      const detail = await apiRequest<{
        vault: {
          id: string
          title: string
          description: string
          cover: string
          ownerName: string | null
          ownerId: string | null
          visibility: Visibility
          collectionEnabled: boolean
          nsfwEnabled: boolean
          starCount: number
          forkCount: number
          createdAt: string
        }
        actorRole?: "owner" | "editor" | "anonymous"
        spaces: Space[]
        resources: Array<Resource & { spaceId: string | null }>
      }>(`/vaults/${vaultId}`)
      const hydratedSet = {
        ...mapVaultDetail(detail),
        isStarred: starredVaults.some((vault) => vault.id === detail.vault.id),
      }

      setSets((currentSets) =>
        currentSets.map((set) => (set.id === hydratedSet.id ? hydratedSet : set))
      )
      setExternalActiveSet((current) =>
        current?.id === hydratedSet.id ? hydratedSet : current
      )
      setSelectedResourceId((currentResourceId) =>
        hydratedSet.resources.some((resource) => resource.id === currentResourceId)
          ? currentResourceId
          : hydratedSet.resources[0]?.id ?? ""
      )
    } catch (error) {
      console.warn("Failed to refresh vault detail.", error)
    }
  }

  async function refreshVaultMetadataStatuses(vaultId: string, resourceIds: string[]) {
    if (resourceIds.length === 0) return

    const data = await apiRequest<{ items: ResourceMetadataStatusItem[] }>(
      `/vaults/${vaultId}/resources/metadata-status?ids=${encodeURIComponent(
        resourceIds.join(",")
      )}`
    )
    const metadataByResourceId = new Map(data.items.map((item) => [item.id, item]))
    if (metadataByResourceId.size === 0) return

    const applyMetadata = (set: ResourceSet) =>
      set.id === vaultId
        ? {
            ...set,
            resources: set.resources.map((resource) => {
              const metadata = metadataByResourceId.get(resource.id)
              if (!metadata) return resource

              return {
                ...resource,
                title: metadata.title,
                description: metadata.description,
                metadataStatus: metadata.metadataStatus,
                metadata: metadata.metadata ?? null,
              }
            }),
          }
        : set

    setSets((currentSets) => currentSets.map(applyMetadata))
    setExternalActiveSet((current) => (current ? applyMetadata(current) : current))
  }

  async function loadVaultPanels(
    vaultId: string,
    options: {
      includeAlerts?: boolean
      includeSettings?: boolean
      includeStarredResources?: boolean
    } = {}
  ) {
    const fallbackVisibility =
      sets.find((set) => set.id === vaultId)?.visibility ?? activeSet?.visibility ?? "private"
    const includeAlerts = options.includeAlerts ?? false
    const includeSettings = options.includeSettings ?? false
    const includeStarredResources = options.includeStarredResources ?? false
    const shareRequest = includeSettings
      ? apiRequest<{ share: ShareSettings | null }>(`/vaults/${vaultId}/share`).catch(
          (reason: unknown) => {
            console.warn("Failed to load vault share settings.", reason)
            return null
          }
        )
      : Promise.resolve(null)
    const collaboratorRequest = includeSettings
      ? apiRequest<{ items: CollaboratorItem[] }>(
          `/vaults/${vaultId}/collaborators`
        ).catch((reason: unknown) => {
          console.warn("Failed to load vault collaborators.", reason)
          return null
        })
      : Promise.resolve(null)
    const alertsRequest = includeAlerts
      ? apiRequest<VaultAlerts>(`/vaults/${vaultId}/alerts`).catch(
          (reason: unknown) => {
            console.warn("Failed to load vault alerts.", reason)
            return null
          }
        )
      : Promise.resolve(null)
    const starredRequest = apiRequest<{ items: StarredVaultItem[] }>("/stars").catch(
      (reason: unknown) => {
        console.warn("Failed to load starred vaults.", reason)
        return null
      }
    )
    const starredResourceRequest = includeStarredResources
      ? apiRequest<{ items: StarredResourceItem[] }>("/resource-stars").catch(
          (reason: unknown) => {
            console.warn("Failed to load starred resources.", reason)
            return null
          }
        )
      : Promise.resolve(null)
    const [
      shareData,
      collaboratorData,
      alertsData,
      starredData,
      starredResourceData,
    ] =
      await Promise.all([
        shareRequest,
        collaboratorRequest,
        alertsRequest,
        starredRequest,
        starredResourceRequest,
      ])

    if (includeSettings) {
      setShare(shareData?.share ?? { visibility: fallbackVisibility })
      setCollaborators(collaboratorData?.items ?? [])
    }
    if (alertsData) {
      setNotifications(alertsData.notifications)
      setUnreadNotificationCount(alertsData.unreadNotificationCount)
      setSubmissions(alertsData.pendingSubmissions)
    }
    if (starredData) {
      setStarredVaults(starredData.items)
      setSets((currentSets) => markStarredSets(currentSets, starredData.items))
    }
    if (starredResourceData) setStarredResources(starredResourceData.items)
  }

  async function refreshVaultAlerts(vaultId: string) {
    const alerts = await apiRequest<VaultAlerts>(
      `/vaults/${vaultId}/alerts?includeSubmissions=false`
    ).catch(
      (reason: unknown) => {
        console.warn("Failed to refresh vault alerts.", reason)
        return null
      }
    )

    if (!alerts) return

    setNotifications(alerts.notifications)
    setUnreadNotificationCount(alerts.unreadNotificationCount)
  }

  async function handleSaveShare() {
    if (!activeSet) return

    try {
      setApiError("")
      const passwordHash =
        share.visibility === "password" ? await sha256Hex(sharePassword.trim()) : undefined

      const result = await apiRequest<{ id: string; slug?: string }>(
        `/vaults/${activeSet.id}/share`,
        {
          method: "PUT",
          body: JSON.stringify({
            visibility: share.visibility,
            passwordHash: passwordHash ?? null,
          }),
        }
      )
      setShare((value) => ({ ...value, id: result.id, slug: result.slug }))
      setSets((currentSets) =>
        currentSets.map((set) =>
          set.id === activeSet.id ? { ...set, visibility: share.visibility } : set
        )
      )
      setSharePassword("")
      await loadVaultPanels(activeSet.id, {
        includeAlerts: isVaultOwner,
        includeSettings: true,
        includeStarredResources: activePage === "star",
      })
      toast.success("分享设置已保存")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to save share settings.")
    }
  }

  function handleMediaVisibleChange(visible: boolean) {
    const nextNsfwEnabled = !visible
    setLocalNsfwEnabled(nextNsfwEnabled)

    try {
      window.localStorage.setItem(LOCAL_NSFW_STORAGE_KEY, String(nextNsfwEnabled))
    } catch (error) {
      console.warn("Failed to save local NSFW preference.", error)
    }
  }

/**
 * 移除协作者的异步处理函数
 * @param collaboratorId - 要移除的协作者ID
 */
  async function handleRemoveCollaborator(collaboratorId: string) {
  // 检查是否有活动集合，如果没有则直接返回
    if (!activeSet) return

    try {
    // 清空API错误信息
      setApiError("")
    // 发送DELETE请求移除协作者
      await apiRequest(`/vaults/${activeSet.id}/collaborators/${collaboratorId}`, {
        method: "DELETE",
      })
    // 重新加载面板数据，根据不同条件加载不同内容
      await loadVaultPanels(activeSet.id, {
        includeAlerts: isVaultOwner,    // 如果是所有者则包含提醒
        includeSettings: true,         // 始终包含设置
        includeStarredResources: activePage === "star",  // 如果当前页面是"star"则包含星标资源
      })
    // 显示成功提示
      toast.success("Editor 已移除")
    } catch (error) {
    // 设置错误信息，如果是Error实例则获取其message，否则使用默认错误信息
      setApiError(error instanceof Error ? error.message : "Failed to remove collaborator.")
    }
  }

  async function handleToggleStar() {
    if (!activeSet) return
    if (!currentUser) {
      toast.info("请先登录后再收藏 vault。")
      return
    }

    const nextStarred = !activeSet.isStarred

    try {
      await apiRequest(`/vaults/${activeSet.id}/star`, {
        method: nextStarred ? "POST" : "DELETE",
        body: JSON.stringify({}),
      })

      setSets((currentSets) =>
        currentSets.map((set) =>
          set.id === activeSet.id
            ? {
                ...set,
                isStarred: nextStarred,
                starCount: Math.max(0, set.starCount + (nextStarred ? 1 : -1)),
              }
            : set
        )
      )
      setStarredVaults((current) => {
        if (!nextStarred) return current.filter((vault) => vault.id !== activeSet.id)
        if (current.some((vault) => vault.id === activeSet.id)) return current
        return [
          {
            id: activeSet.id,
            title: activeSet.name,
            description: activeSet.description,
            visibility: activeSet.visibility,
            starCount: activeSet.starCount + 1,
            forkCount: activeSet.forkCount,
            createdAt: activeSet.createdAt,
          },
          ...current,
        ]
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to update star.")
    }
  }

  async function handleToggleResourceStar(resourceId: string) {
    if (!activeSet) return
    if (!currentUser) {
      toast.info("请先登录后再收藏资源。")
      return
    }

    const resource = activeSet.resources.find((item) => item.id === resourceId)
    if (!resource) return
    const nextStarred = !resource.isStarred

    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              resources: set.resources.map((item) =>
                item.id === resourceId ? { ...item, isStarred: nextStarred } : item
              ),
            }
          : set
      )
    )

    try {
      await apiRequest(`/resources/${resourceId}/star`, {
        method: nextStarred ? "POST" : "DELETE",
      })
      if (nextStarred) await loadStarredResources()
      else {
        setStarredResources((current) =>
          current.filter((item) => item.sourceResourceId !== resourceId)
        )
      }
      toast.success(nextStarred ? "资源已收藏" : "已取消收藏")
    } catch (error) {
      setSets((currentSets) =>
        currentSets.map((set) =>
          set.id === activeSet.id
            ? {
                ...set,
                resources: set.resources.map((item) =>
                  item.id === resourceId ? { ...item, isStarred: resource.isStarred } : item
                ),
              }
            : set
        )
      )
      setApiError(error instanceof Error ? error.message : "Failed to update resource star.")
    }
  }

  async function loadStarredResources() {
    const data = await apiRequest<{ items: StarredResourceItem[] }>("/resource-stars")
    setStarredResources(data.items)
  }

  async function loadReadLaterResources() {
    const data = await apiRequest<{ items: ReadLaterResourceItem[] }>("/resource-read-later")
    setReadLaterResources(data.items)
  }

  function findResourceContext(resourceId: string) {
    const candidateSets = [
      ...(activeSet ? [activeSet] : []),
      ...sets,
      ...(externalActiveSet ? [externalActiveSet] : []),
    ]

    for (const set of candidateSets) {
      const resource = set.resources.find((item) => item.id === resourceId)
      if (!resource) continue
      const space = set.spaces.find((item) => item.id === resource.spaceId)
      return {
        resource,
        set,
        spaceName: space?.name ?? "Unsorted",
      }
    }

    const readLaterItem = readLaterResources.find((item) => item.resourceId === resourceId)
    if (!readLaterItem) return null
    return {
      resource: readLaterItem.resource,
      set: {
        id: readLaterItem.vaultId,
        name: readLaterItem.vaultName,
        spaces: [],
      },
      spaceName: readLaterItem.spaceName,
    }
  }

  function updateResourceEverywhere(
    resourceId: string,
    updater: (resource: Resource) => Resource
  ) {
    const updateSet = (set: ResourceSet) => ({
      ...set,
      resources: set.resources.map((resource) =>
        resource.id === resourceId ? updater(resource) : resource
      ),
    })

    setSets((currentSets) => currentSets.map(updateSet))
    setExternalActiveSet((current) => (current ? updateSet(current) : current))
    setReadLaterResources((current) =>
      current.map((item) =>
        item.resourceId === resourceId
          ? {
              ...item,
              resource: updater(item.resource),
            }
          : item
      )
    )
  }

  async function handleToggleResourceReadLater(resourceId: string) {
    if (!currentUser) {
      toast.info("请先登录后再加入稍后查看。")
      return
    }

    const context = findResourceContext(resourceId)
    if (!context) return

    const previousReadLaterResources = readLaterResources
    const nextReadLater = !context.resource.isReadLater
    const nextResource = { ...context.resource, isReadLater: nextReadLater }
    const savedAt = new Date().toISOString()

    updateResourceEverywhere(resourceId, (resource) => ({
      ...resource,
      isReadLater: nextReadLater,
    }))
    setReadLaterResources((current) => {
      if (!nextReadLater) return current.filter((item) => item.resourceId !== resourceId)
      if (current.some((item) => item.resourceId === resourceId)) return current
      return [
        {
          id: resourceId,
          resourceId,
          vaultId: context.set.id,
          vaultName: context.set.name,
          spaceId: context.resource.spaceId,
          spaceName: context.spaceName,
          savedAt,
          resource: nextResource,
        },
        ...current,
      ]
    })

    try {
      await apiRequest(`/resources/${resourceId}/read-later`, {
        method: nextReadLater ? "POST" : "DELETE",
      })
      toast.success(nextReadLater ? "已加入稍后查看" : "已移出稍后查看")
    } catch (error) {
      updateResourceEverywhere(resourceId, (resource) => ({
        ...resource,
        isReadLater: context.resource.isReadLater,
      }))
      setReadLaterResources(previousReadLaterResources)
      setApiError(error instanceof Error ? error.message : "Failed to update read later.")
    }
  }

  async function handleUpdateResourceAnnotation(
    resourceId: string,
    patch: ResourceAnnotationPatch
  ) {
    if (!currentUser) {
      toast.info("请先登录后再编辑资源批注。")
      return
    }

    const context = findResourceContext(resourceId)
    const previousAnnotation = context?.resource.annotation ?? null
    const optimisticAnnotation = applyResourceAnnotationPatch(previousAnnotation, patch)

    updateResourceEverywhere(resourceId, (resource) => ({
      ...resource,
      annotation: optimisticAnnotation,
    }))

    try {
      const result = await apiRequest<{ annotation: ResourceAnnotation | null }>(
        `/resources/${resourceId}/annotation`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        }
      )
      updateResourceEverywhere(resourceId, (resource) => ({
        ...resource,
        annotation: result.annotation,
      }))
    } catch (error) {
      updateResourceEverywhere(resourceId, (resource) => ({
        ...resource,
        annotation: previousAnnotation,
      }))
      setApiError(error instanceof Error ? error.message : "Failed to update annotation.")
    }
  }

  async function handleClearResourceAnnotation(resourceId: string) {
    if (!currentUser) {
      toast.info("请先登录后再编辑资源批注。")
      return
    }

    const context = findResourceContext(resourceId)
    const previousAnnotation = context?.resource.annotation ?? null

    updateResourceEverywhere(resourceId, (resource) => ({
      ...resource,
      annotation: null,
    }))

    try {
      await apiRequest(`/resources/${resourceId}/annotation`, {
        method: "DELETE",
      })
    } catch (error) {
      updateResourceEverywhere(resourceId, (resource) => ({
        ...resource,
        annotation: previousAnnotation,
      }))
      setApiError(error instanceof Error ? error.message : "Failed to clear annotation.")
    }
  }

  async function handleForkVault() {
    if (!activeSet) return
    if (!currentUser) {
      toast.info("请先登录后再 fork vault。")
      return
    }
    if (isVaultOwner) {
      toast.info("不能 fork 自己的 vault。")
      return
    }

    try {
      const result = await apiRequest<{ id: string; forkId: string }>(
        `/vaults/${activeSet.id}/fork`,
        {
          method: "POST",
        }
      )
      if (isShareMode) {
        router.push("/")
        router.refresh()
        return
      }
      await loadVaults(result.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to fork vault.")
    }
  }

  async function handleApproveSubmission(submissionId: string, spaceId?: string) {
    if (!activeSet) return

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}/submissions/${submissionId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          ...(spaceId ? { spaceId } : {}),
        }),
      })
      toast.success("提交已加入 vault。")
      setSubmissions((current) => current.filter((item) => item.id !== submissionId))
      await loadVaults(activeSet.id)
      await loadVaultPanels(activeSet.id, {
        includeAlerts: isVaultOwner,
        includeSettings: true,
        includeStarredResources: activePage === "star",
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to approve submission.")
    }
  }

  async function handleRejectSubmission(submissionId: string) {
    if (!activeSet) return

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}/submissions/${submissionId}/reject`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      setSubmissions((current) => current.filter((item) => item.id !== submissionId))
      await loadVaultPanels(activeSet.id, {
        includeAlerts: isVaultOwner,
        includeSettings: true,
        includeStarredResources: activePage === "star",
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to reject submission.")
    }
  }

  async function handleToggleCollection(enabled: boolean) {
    if (!activeSet) return

    const previousSets = sets
    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id ? { ...set, collectionEnabled: enabled } : set
      )
    )

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}`, {
        method: "PATCH",
        body: JSON.stringify({ collectionEnabled: enabled }),
      })
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to update collection.")
    }
  }

  async function handleToggleVaultNsfw(enabled: boolean) {
    if (!activeSet) return

    const previousSets = sets

    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id ? { ...set, nsfwEnabled: enabled } : set
      )
    )

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nsfwEnabled: enabled }),
      })
      toast.success(enabled ? "Vault 已默认隐藏媒体" : "Vault 已默认显示媒体")
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to update NSFW mode.")
    }
  }

  async function handleOpenNotifications() {
    if (!currentUser || !activeSet?.id) return

    try {
      const unreadIds = notifications
        .filter(
          (notification) =>
            notification.type === "resource_submission.created" && !notification.readAt
        )
        .map((notification) => notification.id)
      const readAt = new Date().toISOString()

      setNotifications(
        notifications.map((notification) =>
          unreadIds.includes(notification.id) ? { ...notification, readAt } : notification
        )
      )
      setUnreadNotificationCount(0)

      if (unreadIds.length === 0) return

      await apiRequest("/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          notificationIds: unreadIds,
        }),
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to update notifications.")
    }
  }

  async function handleNotificationClick(notification: NotificationItem) {
    if (!notification.vaultId) return

    setActivePage("workspace")
    const loaded =
      notification.vaultId === activeSet?.id
        ? true
        : await loadVaults(notification.vaultId, {
            includeOpenedVaultInList: true,
          })
    if (!loaded) return

    setSettingsTab("submissions")
    await loadVaultPanels(notification.vaultId, {
      includeAlerts: true,
      includeSettings: true,
      includeStarredResources: false,
    })
    setSettingsOpen(true)
  }

  async function handleSearchSelect(item: VaultSearchItem) {
    setActivePage("workspace")
    window.history.replaceState(null, "", getDashboardVaultPath(item.vaultId))
    setResourceDetailsOpen(false)

    if (item.vaultId !== activeSet?.id) {
      const loaded = await loadVaults(item.vaultId, {
        includeOpenedVaultInList: sets.some((set) => set.id === item.vaultId),
      })
      if (!loaded) return
    }
    if (item.kind === "vault" || !item.spaceId) return

    if (item.kind === "resource" && item.resourceId) {
      setSelectedResourceId(item.resourceId)
    }

    searchTargetRequestId.current += 1
    setWorkspaceSearchTarget({
      requestId: searchTargetRequestId.current,
      vaultId: item.vaultId,
      spaceId: item.spaceId,
      resourceId: item.kind === "resource" ? item.resourceId : undefined,
    })
  }

  async function handleOpenStarredVault(vaultId: string) {
    setActivePage("workspace")
    await loadVaults(vaultId, { includeOpenedVaultInList: false })
  }

  async function handleUnstarResourceFromStarPage(sourceResourceId: string) {
    try {
      await apiRequest(`/resources/${sourceResourceId}/star`, {
        method: "DELETE",
      })
      setStarredResources((current) =>
        current.filter((item) => item.sourceResourceId !== sourceResourceId)
      )
      setSets((currentSets) =>
        currentSets.map((set) => ({
          ...set,
          resources: set.resources.map((resource) =>
            resource.id === sourceResourceId ? { ...resource, isStarred: false } : resource
          ),
        }))
      )
      toast.success("已取消收藏")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to unstar resource.")
    }
  }

  async function handleDeleteVault() {
    if (!activeSet) return

    const vaultId = activeSet.id
    const nextSetId = sets.find((set) => set.id !== vaultId)?.id

    try {
      setIsLoading(true)
      setApiError("")
      await apiRequest(`/vaults/${vaultId}`, {
        method: "DELETE",
      })
      setSettingsOpen(false)
      setResourceDetailsOpen(false)
      toast.success("Vault 已删除。")
      setStarredVaults((current) => current.filter((vault) => vault.id !== vaultId))

      if (nextSetId) {
        await loadVaults(nextSetId)
        return
      }

      setSets([])
      setActiveSetId("")
      setSelectedResourceId("")
      setShare({ visibility: "private" })
      setCollaborators([])
      setSubmissions([])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to delete vault.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleExportVault() {
    if (!activeSet) return

    try {
      setIsLoading(true)
      setApiError("")
      const data = await apiRequest<unknown>(`/vaults/${activeSet.id}/export`)
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${toExportFileName(activeSet.name)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success("Vault JSON 已导出")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export vault."
      setApiError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleImportVault(file: File) {
    if (importVaultInFlight.current) return
    importVaultInFlight.current = true

    try {
      setIsLoading(true)
      setIsImportingVault(true)
      setApiError("")
      const text = await file.text()
      const data = JSON.parse(text) as unknown
      const result = await apiRequest<{
        id: string
        importedResources: number
        importedSpaces: number
      }>("/vaults/import", {
        method: "POST",
        body: JSON.stringify({ data }),
      })

      setSettingsOpen(false)

      await loadVaults(result.id)
      toast.success("Vault 导入完成")
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "JSON 文件格式不正确。"
          : error instanceof Error
            ? error.message
            : "Failed to import vault."
      setApiError(message)
      toast.error(message)
    } finally {
      importVaultInFlight.current = false
      setIsImportingVault(false)
      setIsLoading(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    setSets([])
    setExternalActiveSet(null)
    setActiveSetId("")
    setSelectedResourceId("")
    router.replace("/")
    router.refresh()
  }

  async function loadAuthPolicy() {
    try {
      const policy = await apiRequest<AuthPolicy>("/auth-policy")
      setAuthPolicy(policy)
      return policy
    } catch (error) {
      console.warn("Failed to load auth policy.", error)
      return authPolicy
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = authForm.email.trim()
    const password = authForm.password
    const name = authForm.name.trim()
    const formData = new FormData(event.currentTarget)
    const turnstileToken = String(formData.get("turnstileToken") ?? "").trim()
    if (!email) return
    if (authMode !== "forgot-password" && !password) return
    if (authMode === "sign-up" && !authPolicy.allowSignUp) {
      setAuthError("注册已关闭。")
      return
    }
    if (authMode === "sign-up" && !name) return
    if (initialData.turnstileSiteKey && !turnstileToken) {
      setAuthError("请完成人机验证。")
      return
    }

    const fetchOptions = turnstileToken
      ? { headers: { "x-captcha-response": turnstileToken } }
      : undefined

    try {
      setAuthError("")
      if (authMode === "forgot-password") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
          fetchOptions,
        })

        if (result.error) {
          setAuthError(result.error.message ?? "密码重置邮件发送失败，请稍后再试。")
          return
        }

        setAuthForm(emptyAuthForm)
        setAuthDialogOpen(false)
        setAuthMode("sign-in")
        toast.success("如果该邮箱存在，请查看密码重置邮件。")
        return
      }

      const result =
        authMode === "sign-up"
          ? await authClient.signUp.email({ email, password, name, fetchOptions })
          : await authClient.signIn.email({ email, password, fetchOptions })

      if (result.error) {
        setAuthError(result.error.message ?? "认证失败，请稍后再试。")
        return
      }

      setAuthForm(emptyAuthForm)
      setAuthDialogOpen(false)
      toast.success(authMode === "sign-up" ? "注册成功，已登录" : "登录成功")
      router.refresh()
      if (!isShareMode) await loadVaults(activeSet?.id)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "认证失败，请稍后再试。")
    }
  }

  async function handleCreateSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = setForm.name.trim()
    if (!name || saveVaultInFlight.current) return
    saveVaultInFlight.current = true

    try {
      setIsSavingVault(true)
      setApiError("")
      if (setDialogMode === "edit") {
        if (!activeSet) return

        await apiRequest(`/vaults/${activeSet.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: name,
            description: setForm.description.trim(),
            cover: setForm.cover.trim(),
            visibility: setForm.visibility === "password" ? "private" : setForm.visibility,
          }),
        })
        setSetForm(emptySetForm)
        setSetDialogOpen(false)
        await loadVaults(activeSet.id)
        toast.success("Vault 信息已保存")
        return
      }

      const created = await apiRequest<{ id: string; defaultSpaceId: string }>("/vaults", {
        method: "POST",
        body: JSON.stringify({
          title: name,
          description: setForm.description.trim(),
          cover: setForm.cover.trim(),
          visibility: setForm.visibility === "password" ? "private" : setForm.visibility,
        }),
      })

      setSetForm(emptySetForm)
      setSetDialogOpen(false)
      await loadVaults(created.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to save vault.")
    } finally {
      saveVaultInFlight.current = false
      setIsSavingVault(false)
    }
  }

  function openCreateVaultDialog() {
    setSetDialogMode("create")
    setSetForm(emptySetForm)
    setSetDialogOpen(true)
  }

  function openEditVaultDialog() {
    if (!activeSet) return

    setSetDialogMode("edit")
    setSetForm({
      name: activeSet.name,
      description: activeSet.description,
      cover: activeSet.cover,
      visibility: activeSet.visibility,
    })
    setSetDialogOpen(true)
  }

  async function handleCreateSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeSet) return

    const name = spaceForm.name.trim()
    if (!name) return
    const targetVaultId = editingSpaceId ? activeSet.id : spaceDialogVaultId || activeSet.id
    const knownSpaces =
      targetVaultId === activeSet.id
        ? activeSet.spaces
        : (transferTargets.find((target) => target.id === targetVaultId)?.spaces ?? [])
    const duplicateSpace = knownSpaces.some(
      (space) =>
        space.name.trim().toLowerCase() === name.toLowerCase() &&
        space.id !== editingSpaceId
    )

    if (duplicateSpace) {
      toast.error("Space 名称已存在。")
      return
    }

    try {
      setApiError("")
      if (editingSpaceId) {
        await apiRequest(`/vaults/${activeSet.id}/spaces/${editingSpaceId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            description: spaceForm.description.trim(),
            icon: spaceForm.icon,
          }),
        })
      } else {
        const created = await apiRequest<{ id: string }>(`/vaults/${targetVaultId}/spaces`, {
          method: "POST",
          body: JSON.stringify({
            name,
            description: spaceForm.description.trim(),
            icon: spaceForm.icon,
          }),
        })
        if (targetVaultId === activeSet.id) {
          setResourceForm((form) => ({ ...form, spaceId: created.id }))
        }
        if (spaceDialogVaultId) {
          setTransferFocusSpaceId(created.id)
          await loadResourceTransferTargets()
        }
      }

      setSpaceForm(emptySpaceForm)
      setSpaceDialogVaultId("")
      setEditingSpaceId("")
      setSpaceDialogOpen(false)
      if (targetVaultId === activeSet.id) {
        await loadVaults(activeSet.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create space."
      setApiError(message)
      toast.error(message)
    }
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeSet) return
    if (createResourceInFlight.current) return

    const title = resourceForm.title.trim()
    const url = createCloudDriveUrlWithPassword(
      resourceForm.url,
      resourceForm.extractionCode
    )
    if (!url) return
    const description = resourceForm.description.trim()
    const targetSpaceId = resourceForm.spaceId || activeSet.spaces[0]?.id || ""

    createResourceInFlight.current = true
    setIsResourceSubmitting(true)

    try {
      setApiError("")
      const created = await apiRequest<{ id: string }>(`/vaults/${activeSet.id}/resources`, {
        method: "POST",
        body: JSON.stringify({
          spaceId: targetSpaceId || undefined,
          ...(title ? { title } : {}),
          url,
          description,
          referer: resourceForm.referer.trim() || undefined,
        }),
      })
      const parsedResource = parseResourceInput({
        url,
        ...(title ? { title } : {}),
      })
      const now = new Date().toISOString()
      const maxPosition = Math.max(
        -1,
        ...activeSet.resources
          .filter((resource) => resource.spaceId === targetSpaceId)
          .map((resource) => resource.position)
      )
      const optimisticResource: Resource = {
        id: created.id,
        spaceId: targetSpaceId,
        title: parsedResource.title,
        type: parsedResource.type,
        url: parsedResource.url,
        referer: resourceForm.referer.trim() || null,
        description,
        metadataStatus: "pending",
        metadata: null,
        isStarred: false,
        position: maxPosition + 1,
        createdBy: currentUserId ?? null,
        createdAt: now,
      }

      setResourceForm(emptyResourceForm)
      setSelectedResourceId(created.id)
      setResourceDialogOpen(false)
      setSets((currentSets) =>
        currentSets.map((set) =>
          set.id === activeSet.id
            ? {
                ...set,
                resourceCount: set.resourceCount + 1,
                resources: set.resources.some((resource) => resource.id === created.id)
                  ? set.resources
                  : [...set.resources, optimisticResource],
              }
            : set
        )
      )
      setExternalActiveSet((current) =>
        current?.id === activeSet.id
          ? {
              ...current,
              resourceCount: current.resourceCount + 1,
              resources: current.resources.some((resource) => resource.id === created.id)
                ? current.resources
                : [...current.resources, optimisticResource],
            }
          : current
      )
      await refreshVaultDetail(activeSet.id)
      setSelectedResourceId(created.id)
      scrollToWorkspaceTarget(`resource-${created.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create resource."
      setApiError(message)
      toast.error(message)
    } finally {
      createResourceInFlight.current = false
      setIsResourceSubmitting(false)
    }
  }

  function handleCreateUploadedMedia(files: File[]) {
    if (!activeSet || files.length === 0) return

    const vaultId = activeSet.id
    const targetSpaceId = resourceForm.spaceId || activeSet.spaces[0]?.id || ""
    const form = {
      description: resourceForm.description.trim(),
      referer: resourceForm.referer.trim(),
      title: resourceForm.title.trim(),
    }
    const uploadId = `create:${crypto.randomUUID()}`
    setLocalMediaUploads((current) => [
      ...current,
      {
        resourceId: uploadId,
        phase: "preparing",
        completedBytes: 0,
        totalBytes: Math.max(files.reduce((sum, file) => sum + file.size, 0), 1),
      },
    ])
    setResourceForm(emptyResourceForm)
    setResourceDialogOpen(false)
    void createUploadedMediaInBackground(vaultId, targetSpaceId, form, files, uploadId)
  }

  async function createUploadedMediaInBackground(
    vaultId: string,
    targetSpaceId: string,
    form: { description: string; referer: string; title: string },
    files: File[],
    uploadId: string,
  ) {
    let lastProgress = -1
    try {
      setApiError("")
      const thumbnails = await Promise.all(files.map((file) =>
        file.type.startsWith("video/") ? createVideoThumbnail(file) : undefined
      ))
      const uploaded = await uploadLocalMediaMultipart({
        files,
        thumbnails,
        preparePath: `/vaults/${vaultId}/resources/local-media/multipart`,
        onProgress: (value, uploadedBytes, totalBytes) => {
          const progress = Math.floor(value)
          if (progress !== 100 && progress - lastProgress < 2) return
          lastProgress = progress
          setLocalMediaUploads((current) => current.map((upload) =>
            upload.resourceId === uploadId
              ? {
                  ...upload,
                  phase: "uploading",
                  completedBytes: uploadedBytes,
                  totalBytes: totalBytes || upload.totalBytes,
                }
              : upload
          ))
        },
      })
      setLocalMediaUploads((current) => current.map((upload) =>
        upload.resourceId === uploadId
          ? { ...upload, phase: "syncing", completedBytes: upload.totalBytes }
          : upload
      ))
      let created: { id: string }
      try {
        created = await apiRequest<{ id: string }>(
          `/vaults/${vaultId}/resources/local-media`,
          {
            method: "POST",
            body: JSON.stringify({
              resourceId: uploaded.resourceId,
              files: uploaded.files,
              ...(targetSpaceId ? { spaceId: targetSpaceId } : {}),
              ...(form.title ? { title: form.title } : {}),
              ...(form.description
                ? { description: form.description }
                : {}),
              ...(form.referer
                ? { referer: form.referer }
                : {}),
            }),
          },
        )
      } catch (error) {
        await uploaded.cleanup()
        throw error
      }

      setSelectedResourceId(created.id)
      await refreshVaultDetail(vaultId)
      setSelectedResourceId(created.id)
      scrollToWorkspaceTarget(`resource-${created.id}`)
      toast.success("媒体已上传")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload resource media."
      toast.error("媒体上传失败", { description: message })
    } finally {
      setLocalMediaUploads((current) => current.filter((upload) => upload.resourceId !== uploadId))
    }
  }

  function openResourceDialog() {
    if (!canAddResource) return

    setResourceForm((form) => ({
      ...form,
      spaceId: activeSet?.spaces[0]?.id ?? "",
    }))
    setResourceDialogOpen(true)
  }

  function openResourceDialogForSpace(spaceId: string) {
    if (!canAddResource) return

    setResourceForm((form) => ({
      ...form,
      spaceId,
    }))
    setResourceDialogOpen(true)
  }

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab)
    setSettingsOpen(true)
    if (activeSet?.id && currentUser) {
      void loadVaultPanels(activeSet.id, {
        includeAlerts: isVaultOwner,
        includeSettings: true,
        includeStarredResources: activePage === "star",
      })
    }
  }

  function openCreateSpaceDialog(vaultId?: string) {
    const targetVaultId = typeof vaultId === "string" ? vaultId : activeSet?.id ?? ""

    setSpaceForm(emptySpaceForm)
    setSpaceDialogVaultId(targetVaultId)
    setEditingSpaceId("")
    setSpaceDialogOpen(true)
  }

  function openEditSpaceDialog(space: Space) {
    setSpaceForm({
      name: space.name,
      description: space.description,
      icon: space.icon,
    })
    setSpaceDialogVaultId(activeSet?.id ?? "")
    setEditingSpaceId(space.id)
    setSpaceDialogOpen(true)
  }

  function openCreateTransferTargetSpace(vaultId: string) {
    setSpaceForm(emptySpaceForm)
    setSpaceDialogVaultId(vaultId)
    setEditingSpaceId("")
    setSpaceDialogOpen(true)
  }

  function handleSelectResource(resourceId: string) {
    const resource = activeSet?.resources.find((item) => item.id === resourceId)
    if (!resource) return

    setSelectedResourceId(resourceId)
    if (isResourceResolving(resource.metadataStatus)) return

    if (
      !getVaultAccess({
        activeSet,
        currentUserId,
        selectedResource: resource,
      }).canEditResource
    ) {
      return
    }

    setResourceDetailsOpen(true)
  }

  function handleActivateResource(resourceId: string) {
    const resource = activeSet?.resources.find((item) => item.id === resourceId)
    if (!resource) return

    setSelectedResourceId(resourceId)
    setResourceDetailsOpen(false)
  }

  async function handleUpdateResource(form: ResourceDetailsForm) {
    if (!activeSet || !selectedResource) return

    const previousSets = sets
    const resourceId = selectedResource.id
    const isLocalMediaResource = selectedResource.type === "local_media"
    setIsLoading(true)
    setApiError("")

    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              resources: set.resources.map((resource) =>
                resource.id === resourceId
                  ? {
                      ...resource,
                      title: form.title,
                      description: form.description,
                      url: isLocalMediaResource ? resource.url : form.url,
                      referer: form.referer || null,
                      spaceId: form.spaceId,
                      metadataStatus: !isLocalMediaResource && form.url !== resource.url
                        ? ("pending" as const)
                        : resource.metadataStatus,
                    }
                  : resource
              ),
            }
          : set
      )
    )

    try {
      await apiRequest(`/resources/${resourceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          ...(isLocalMediaResource ? {} : { url: form.url }),
          referer: form.referer,
          spaceId: form.spaceId,
        }),
      })
      await refreshVaultDetail(activeSet.id)
      setSelectedResourceId(resourceId)
      setResourceDetailsOpen(false)
    } catch (error) {
      setSets(previousSets)
      const message = error instanceof Error ? error.message : "Failed to update resource."
      setApiError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleUpdateLocalMedia(
    form: ResourceDetailsForm,
    input: { files: File[]; order: string[] }
  ) {
    if (!activeSet || !selectedResource) return

    const vaultId = activeSet.id
    const resourceId = selectedResource.id
    if (localMediaUploadInFlight.current.has(resourceId)) return

    localMediaUploadInFlight.current.add(resourceId)
    setLocalMediaUploadResourceIds((current) => [...current, resourceId])
    setLocalMediaUploads((current) => [
      ...current,
      {
        resourceId,
        phase: "preparing",
        completedBytes: 0,
        totalBytes: Math.max(
          input.files.reduce((sum, file) => sum + file.size, 0),
          1
        ),
      },
    ])
    setResourceDetailsOpen(false)
    void updateLocalMediaInBackground(vaultId, resourceId, form, input)
  }

  async function updateLocalMediaInBackground(
    vaultId: string,
    resourceId: string,
    form: ResourceDetailsForm,
    input: { files: File[]; order: string[] }
  ) {
    let lastProgress = -1

    try {
      const thumbnails = await Promise.all(input.files.map((file) =>
        file.type.startsWith("video/") ? createVideoThumbnail(file) : undefined
      ))
      const uploaded = input.files.length > 0
        ? await uploadLocalMediaMultipart({
            files: input.files,
            thumbnails,
            preparePath: `/resources/${resourceId}/local-media/multipart`,
            onProgress: (value, uploadedBytes, totalBytes) => {
              const progress = Math.floor(value)
              if (progress !== 100 && progress - lastProgress < 2) return
              lastProgress = progress
              setLocalMediaUploads((current) => current.map((upload) =>
                upload.resourceId === resourceId
                  ? {
                      ...upload,
                      phase: "uploading",
                      completedBytes: uploadedBytes,
                      totalBytes: totalBytes || upload.totalBytes,
                    }
                  : upload
              ))
            },
          })
        : { cleanup: async () => {}, files: [] }

      setLocalMediaUploads((current) => current.map((upload) =>
        upload.resourceId === resourceId
          ? {
              ...upload,
              phase: "syncing",
              completedBytes: upload.totalBytes,
            }
          : upload
      ))

      try {
        await apiRequest(`/resources/${resourceId}/local-media`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            referer: form.referer,
            spaceId: form.spaceId,
            order: input.order,
            files: uploaded.files,
          }),
        })
      } catch (error) {
        await uploaded.cleanup()
        throw error
      }

      await refreshVaultDetail(vaultId)
      setSelectedResourceId(resourceId)
      toast.success("媒体已更新", {
        description: "资源列表已刷新。",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update resource media."
      setApiError(message)
      toast.error("媒体更新失败", { description: message })
    } finally {
      localMediaUploadInFlight.current.delete(resourceId)
      setLocalMediaUploadResourceIds((current) => current.filter((id) => id !== resourceId))
      setLocalMediaUploads((current) => current.filter((upload) => upload.resourceId !== resourceId))
    }
  }

  async function handleMoveResource(input: {
    resourceId: string
    sourceSpaceId: string
    targetSpaceId: string
    position: number
  }) {
    if (!activeSet) return

    const previousSets = sets
    const nextResources = moveResourceInList(activeSet.resources, input)
    const resourcesToPersist = nextResources.filter(
      (resource) =>
        resource.spaceId === input.sourceSpaceId || resource.spaceId === input.targetSpaceId
    )

    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              resources: moveResourceInList(set.resources, input),
            }
          : set
      )
    )

    try {
      await apiRequest(`/vaults/${activeSet.id}/resources/reorder`, {
        method: "PATCH",
        body: JSON.stringify({
          items: resourcesToPersist.map((resource) => ({
            id: resource.id,
            spaceId: resource.spaceId,
            position: resource.position,
          })),
        }),
      })
      setSelectedResourceId(input.resourceId)
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to move resource.")
    }
  }

  async function loadResourceTransferTargets() {
    const data = await apiRequest<{ items: ResourceTransferTargetVault[] }>(
      "/resources/transfer-targets"
    )
    setTransferTargets(data.items)
  }

  async function handleTransferResource(input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) {
    if (!activeSet) return

    try {
      await apiRequest<{
        id: string
        action: "move" | "copy"
        vaultId: string
        spaceId: string
      }>(`/resources/${input.resourceId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          action: input.action,
          targetVaultId: input.targetVaultId,
          targetSpaceId: input.targetSpaceId,
        }),
      })

      toast.success(input.action === "move" ? "Resource 已移动" : "Resource 已复制")
      if (input.action === "move" && input.targetVaultId !== activeSet.id) {
        setSets((currentSets) =>
          currentSets.map((set) =>
            set.id === activeSet.id
              ? {
                  ...set,
                  resourceCount: Math.max(0, set.resourceCount - 1),
                  resources: set.resources.filter((resource) => resource.id !== input.resourceId),
                }
              : set
          )
        )
        setSelectedResourceId("")
        setResourceDetailsOpen(false)
        return
      }

      await refreshVaultDetail(activeSet.id)
      setSelectedResourceId(input.action === "move" ? input.resourceId : selectedResourceId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to transfer resource."
      setApiError(message)
      toast.error(message)
    }
  }

  async function handleTransferResources(input: {
    action: "move" | "copy"
    resourceIds: string[]
    targetVaultId: string
    targetSpaceId: string
  }) {
    if (!activeSet || input.resourceIds.length === 0) return

    try {
      await apiRequest<{
        action: "move" | "copy"
        items: Array<{
          id: string
          sourceId?: string
          action: "move" | "copy"
          vaultId: string
          spaceId: string
        }>
      }>("/resources/transfer", {
        method: "POST",
        body: JSON.stringify(input),
      })

      if (input.action === "move" && input.targetVaultId !== activeSet.id) {
        const movedIds = new Set(input.resourceIds)
        setSets((currentSets) =>
          currentSets.map((set) =>
            set.id === activeSet.id
              ? {
                  ...set,
                  resourceCount: Math.max(0, set.resourceCount - movedIds.size),
                  resources: set.resources.filter((resource) => !movedIds.has(resource.id)),
                }
              : set
          )
        )
        if (selectedResourceId && movedIds.has(selectedResourceId)) {
          setSelectedResourceId("")
          setResourceDetailsOpen(false)
        }
      } else {
        await refreshVaultDetail(activeSet.id)
      }

      toast.success(
        input.action === "move"
          ? `已移动 ${input.resourceIds.length} 个 Resource`
          : `已复制 ${input.resourceIds.length} 个 Resource`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to transfer resources."
      setApiError(message)
      toast.error(message)
      throw error instanceof Error ? error : new Error(message)
    }
  }

  async function handleReorderSpace(input: { spaceId: string; position: number }) {
    if (!activeSet) return

    const previousSets = sets
    const nextSpaces = moveSpaceInList(activeSet.spaces, input)

    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              spaces: moveSpaceInList(set.spaces, input),
            }
          : set
      )
    )

    try {
      await apiRequest(`/vaults/${activeSet.id}/spaces/reorder`, {
        method: "PATCH",
        body: JSON.stringify({
          items: nextSpaces.map((space) => ({
            id: space.id,
            position: space.position,
          })),
        }),
      })
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to reorder space.")
    }
  }

  async function handleUpdateSpaceIcon(spaceId: string, icon: string) {
    if (!activeSet) return

    const previousSets = sets
    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              spaces: set.spaces.map((space) =>
                space.id === spaceId ? { ...space, icon } : space
              ),
            }
          : set
      )
    )

    try {
      await apiRequest(`/vaults/${activeSet.id}/spaces/${spaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ icon }),
      })
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to update space icon.")
    }
  }

  async function handleTransferSpace(spaceId: string, targetVaultId: string) {
    if (!activeSet) return

    try {
      await apiRequest(`/vaults/${activeSet.id}/spaces/${spaceId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ targetVaultId }),
      })
      await loadVaults(activeSet.id)
      toast.success("Space 已移动")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move space."
      setApiError(message)
      toast.error(message)
      throw error instanceof Error ? error : new Error(message)
    }
  }

  async function handleDeleteSpace(spaceId: string) {
    if (!activeSet) return

    const previousSets = sets
    setSets((currentSets) =>
      currentSets.map((set) =>
        set.id === activeSet.id
          ? {
              ...set,
              spaces: set.spaces.filter((space) => space.id !== spaceId),
              resources: set.resources.filter((resource) => resource.spaceId !== spaceId),
            }
          : set
      )
    )

    try {
      await apiRequest(`/vaults/${activeSet.id}/spaces/${spaceId}`, {
        method: "DELETE",
      })
      await loadVaults(activeSet.id)
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to delete space.")
    }
  }

  async function handleDeleteResource(resourceId: string) {
    const previousSets = sets
    setSets((currentSets) =>
      currentSets.map((set) => ({
        ...set,
        resources: set.resources.filter((resource) => resource.id !== resourceId),
      }))
    )
    if (selectedResourceId === resourceId) {
      setSelectedResourceId("")
      setResourceDetailsOpen(false)
    }

    try {
      await apiRequest(`/resources/${resourceId}`, {
        method: "DELETE",
      })
      if (activeSet) await loadVaults(activeSet.id)
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to delete resource.")
    }
  }

  async function handleResolveResourceMetadata(resourceId: string) {
    if (!activeSet) return

    const previousSets = sets
    setApiError("")
    setSets((currentSets) =>
      currentSets.map((set) => ({
        ...set,
        resources: set.resources.map((resource) =>
          resource.id === resourceId
            ? {
                ...resource,
                metadataStatus: "pending",
              }
            : resource
        ),
      }))
    )

    try {
      await apiRequest(`/resources/${resourceId}/metadata/resolve`, {
        method: "POST",
      })
      await refreshVaultDetail(activeSet.id)
      toast.success("metadata 已重新获取")
    } catch (error) {
      setSets(previousSets)
      const message = error instanceof Error ? error.message : "Failed to refresh metadata."
      setApiError(message)
      toast.error(message)
    }
  }

  function handleHomeNavigation() {
    setActivePage("workspace")
    router.push("/")
  }

  function handleOpenConsole() {
    setActivePage("workspace")
    router.push("/")
  }

  function handleTopbarPageChange(page: VaultTopbarPage) {
    if (isShareMode) {
      router.push(page === "workspace" ? "/" : `/?page=${page}`)
      return
    }

    setActivePage(page)
    const nextUrl =
      page === "workspace"
        ? getDashboardVaultPath(activeSet?.id)
        : `/dashboard?page=${page}`
    window.history.replaceState(null, "", nextUrl)
  }

  return (
    <main className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <VaultTopbar
        activePage={activePage}
        currentUserName={currentUserName}
        isSignedIn={Boolean(currentUser)}
        isSessionPending={false}
        mobileSidebarEnabled={!isShareMode}
        notifications={notifications}
        onAuthOpen={() => void (async () => {
          const policy = await loadAuthPolicy()
          setAuthMode("sign-in")
          setAuthError("")
          setAuthPolicy(policy)
          setAuthDialogOpen(true)
        })()}
        onHome={handleHomeNavigation}
        onNotificationsOpen={() => void handleOpenNotifications()}
        onNotificationClick={(notification) => void handleNotificationClick(notification)}
        onOpenConsole={handleOpenConsole}
        onPageChange={handleTopbarPageChange}
        onSearchSelect={(item) => void handleSearchSelect(item)}
        onSignOut={handleSignOut}
        searchEnabled={!isShareMode}
        showAuthEntry={authPolicy.reason !== "first-user"}
        unreadNotificationCount={unreadNotificationCount}
        currentVaultSearchItems={currentVaultSearchItems}
        globalSearchItems={globalSearchItems}
      />
      <SidebarProvider
        className="min-h-0 flex-1 overflow-hidden bg-background text-foreground"
        style={{
          "--sidebar-width": "236px",
          "--sidebar-width-icon": "52px",
        } as React.CSSProperties}
      >
      {!isShareMode && (
        <>
          <SidebarTrigger
            className="fixed left-2 top-2 z-40 size-8 border border-line-soft bg-ink-800/90 text-fg-dim shadow-sm backdrop-blur transition hover:border-jade-dim hover:bg-ink-750 hover:text-jade md:hidden"
            title="打开 Vault 导航"
            type="button"
          />
          <VaultSidebar
            activeSetId={activeSetId}
            disabled={!currentUser || isLoading}
            isImporting={isImportingVault}
            mediaVisible={mediaVisible}
            onMediaVisibleChange={handleMediaVisibleChange}
            onCreateVault={openCreateVaultDialog}
            onImportVault={(file) => void handleImportVault(file)}
            onSelectStarredVault={(id) => void handleOpenStarredVault(id)}
            onSelectVault={(id) => {
              setActivePage("workspace")
              void loadVaults(id)
            }}
            onSignOut={() => void handleSignOut()}
            sets={sets}
            starredVaults={starredVaults}
            user={
              currentUser
                ? {
                    email: currentUser.email,
                    image: currentUserImage,
                    name: currentUserName || "Nexus user",
                  }
                : undefined
            }
          />
        </>
      )}
      <SidebarInset className="h-full min-h-0 overflow-hidden bg-background">
        <div className="h-full min-h-0 overflow-hidden">
        {activePage === "star" && !isShareMode ? (
          <StarPage
            isSignedIn={Boolean(currentUser)}
            mediaVisible={mediaVisible}
            onResourceUnstar={(sourceResourceId) =>
              void handleUnstarResourceFromStarPage(sourceResourceId)
            }
            resourceItems={starredResources}
          />
        ) : activePage === "watch-later" && !isShareMode ? (
          <WatchLaterPage
            items={readLaterResources}
            isSignedIn={Boolean(currentUser)}
            mediaVisible={mediaVisible}
            onClearResourceAnnotation={handleClearResourceAnnotation}
            onToggleReadLater={handleToggleResourceReadLater}
            onToggleResourceStar={(resourceId) => void handleToggleResourceStar(resourceId)}
            onUpdateResourceAnnotation={handleUpdateResourceAnnotation}
          />
        ) : (
          <VaultDocument
            activeSet={visibleActiveSet}
            collaboratorsCount={collaborators.length + (activeSet ? 1 : 0)}
            canAddResource={canAddResource}
            currentUserId={currentUserId}
            isSignedIn={Boolean(currentUser)}
            isVaultEditor={isVaultEditor}
            isVaultOwner={isVaultOwner}
            isShareMode={isShareMode}
            isVaultLoading={Boolean(activeSet?.id && loadingVaultId === activeSet.id)}
            mediaVisible={mediaVisible}
            onAddResource={openResourceDialog}
            onAddResourceToSpace={openResourceDialogForSpace}
            onAddSpace={() => openCreateSpaceDialog()}
            onActivateResource={handleActivateResource}
            onCreateTransferTargetSpace={openCreateTransferTargetSpace}
            onCreateVault={openCreateVaultDialog}
            onClearResourceAnnotation={handleClearResourceAnnotation}
            onDeleteResource={handleDeleteResource}
            onDeleteSpace={handleDeleteSpace}
            onDeleteVault={handleDeleteVault}
            onEditVault={openEditVaultDialog}
            onForkVault={handleForkVault}
            onLoadTransferTargets={loadResourceTransferTargets}
            onMoveResource={handleMoveResource}
            onMoveSpace={handleTransferSpace}
            onOpenSettings={openSettings}
            onReorderSpace={handleReorderSpace}
            onResolveResourceMetadata={(resourceId) =>
              void handleResolveResourceMetadata(resourceId)
            }
            onSelectResource={handleSelectResource}
            onToggleResourceReadLater={handleToggleResourceReadLater}
            onToggleResourceStar={handleToggleResourceStar}
            onToggleStar={handleToggleStar}
            onTransferResource={handleTransferResource}
            onTransferResources={handleTransferResources}
            onToggleMediaVisibility={handleMediaVisibleChange}
            onEditSpace={openEditSpaceDialog}
            onUpdateSpaceIcon={handleUpdateSpaceIcon}
            onUpdateResourceAnnotation={handleUpdateResourceAnnotation}
            pendingSubmissionCount={submissions.length}
            searchTarget={workspaceSearchTarget}
            selectedResourceId={selectedResource?.id}
            transferFocusSpaceId={transferFocusSpaceId}
            transferTargets={transferTargets}
            shareSubmissionSlot={
              initialData.shareSlug && activeSet?.collectionEnabled ? (
                <ShareSubmissionDialog
                  slug={initialData.shareSlug}
                  spaces={activeSet.spaces}
                  turnstileSiteKey={initialData.turnstileSiteKey}
                />
              ) : null
            }
          />
        )}
      </div>
      </SidebarInset>

      <VaultSettingsSheet
        activeTab={settingsTab}
        canDeleteVault={isVaultOwner}
        collectionEnabled={activeSet?.collectionEnabled ?? false}
        collaborators={collaborators}
        isBusy={isLoading}
        isImporting={isImportingVault}
        nsfwEnabled={activeSet?.nsfwEnabled ?? true}
        onCollectionEnabledChange={(enabled) => void handleToggleCollection(enabled)}
        onNsfwEnabledChange={(enabled) => void handleToggleVaultNsfw(enabled)}
        onOpenChange={setSettingsOpen}
        onRemoveCollaborator={(collaboratorId) => void handleRemoveCollaborator(collaboratorId)}
        onSubmitShare={handleSaveShare}
        onApproveSubmission={handleApproveSubmission}
        onDeleteVault={handleDeleteVault}
        onExportVault={() => void handleExportVault()}
        onImportVault={(file) => void handleImportVault(file)}
        onRejectSubmission={handleRejectSubmission}
        onTabChange={setSettingsTab}
        onVisibilityChange={(visibility) => setShare((value) => ({ ...value, visibility }))}
        open={settingsOpen}
        ownerName={activeSet?.ownerName ?? "Owner"}
        password={sharePassword}
        setPassword={setSharePassword}
        share={share}
        spaces={activeSet?.spaces ?? []}
        submissions={submissions}
      />

      <ResourceDetailsSheet
        canEdit={Boolean(currentUser) && canEditSelectedResource}
        isBusy={
          isLoading ||
          (selectedResource ? localMediaUploadResourceIds.includes(selectedResource.id) : false)
        }
        onOpenChange={setResourceDetailsOpen}
        onSave={handleUpdateResource}
        onSaveLocalMedia={handleUpdateLocalMedia}
        open={resourceDetailsOpen}
        resource={selectedResource}
        spaces={activeSet?.spaces ?? []}
      />

      <CreateSetDialog
        form={setForm}
        isSubmitting={isSavingVault}
        mode={setDialogMode}
        onFormChange={setSetForm}
        onOpenChange={(open) => {
          setSetDialogOpen(open)
          if (!open) {
            setSetDialogMode("create")
            setSetForm(emptySetForm)
          }
        }}
        onSubmit={handleCreateSet}
        open={setDialogOpen}
      />
      <CreateSpaceDialog
        contextLabel={spaceDialogVaultTitle}
        form={spaceForm}
        mode={editingSpaceId ? "edit" : "create"}
        onFormChange={setSpaceForm}
        onOpenChange={(open) => {
          setSpaceDialogOpen(open)
          if (!open) {
            setSpaceForm(emptySpaceForm)
            setEditingSpaceId("")
            setSpaceDialogVaultId("")
          }
        }}
        onSubmit={handleCreateSpace}
        open={spaceDialogOpen}
      />
      <CreateResourceDialog
        allowMediaUpload={allowResourceMediaUpload}
        form={resourceForm}
        isSubmitting={isResourceSubmitting}
        onFormChange={setResourceForm}
        onMediaSubmit={handleCreateUploadedMedia}
        onOpenChange={setResourceDialogOpen}
        onSubmit={handleCreateResource}
        open={resourceDialogOpen}
        spaces={activeSet?.spaces ?? []}
      />
      <AuthDialog
        allowSignUp={authPolicy.allowSignUp}
        error={authError}
        form={authForm}
        mode={authMode}
        onErrorReset={() => setAuthError("")}
        onFormChange={setAuthForm}
        onModeChange={setAuthMode}
        onOpenChange={setAuthDialogOpen}
        onSubmit={handleAuthSubmit}
        open={authDialogOpen}
        registrationReason={authPolicy.reason}
        turnstileSiteKey={initialData.turnstileSiteKey}
      />
      </SidebarProvider>
    </main>
  )
}

function applyResourceAnnotationPatch(
  annotation: ResourceAnnotation | null,
  patch: ResourceAnnotationPatch
): ResourceAnnotation | null {
  const next = {
    checked: patch.checked ?? annotation?.checked ?? false,
    rating: patch.rating === undefined ? annotation?.rating ?? null : patch.rating,
    comment: patch.comment ?? annotation?.comment ?? "",
    dataJson: patch.dataJson ?? annotation?.dataJson ?? {},
    createdAt: annotation?.createdAt,
    updatedAt: new Date().toISOString(),
  }

  if (
    !next.checked &&
    !(next.rating && next.rating > 0) &&
    !next.comment.trim() &&
    Object.keys(next.dataJson).length === 0
  ) {
    return null
  }

  return next
}

function isResourceResolving(status: Resource["metadataStatus"]) {
  return status === "pending" || status === "processing"
}

function isResourceAiSummaryResolving(resource: Resource) {
  const value = resource.metadata?.data?.extra?.aiSummary
  if (!value || typeof value !== "object") return false
  const state = value as Record<string, unknown>
  const status = state.status
  if (status !== "pending" && status !== "processing") return false

  const timestamp = [state.startedAt, state.requestedAt, resource.metadata?.updatedAt]
    .find((item): item is string => typeof item === "string" && item.length > 0)
  if (!timestamp) return true
  const startedAt = Date.parse(timestamp)
  return !Number.isFinite(startedAt) || Date.now() - startedAt < 2 * 60 * 1000
}

function mergeVaultListWithExisting(
  listItems: ResourceSet[],
  currentSets: ResourceSet[],
  hydratedSet?: ResourceSet
) {
  const currentById = new Map(currentSets.map((set) => [set.id, set]))
  const hasHydratedSet = hydratedSet
    ? listItems.some((item) => item.id === hydratedSet.id)
    : false

  const mergedItems = listItems.map((item) => {
    if (hydratedSet && item.id === hydratedSet.id) return hydratedSet

    const existing = currentById.get(item.id)
    if (!existing) return item

    return {
      ...item,
      spaces: existing.spaces,
      resources: existing.resources,
    }
  })

  if (!hydratedSet) return mergedItems
  return hasHydratedSet ? mergedItems : [hydratedSet, ...mergedItems]
}

function markStarredSets(sets: ResourceSet[], starredVaults: StarredVaultItem[]) {
  const starredIds = new Set(starredVaults.map((vault) => vault.id))

  return sets.map((set) => ({
    ...set,
    isStarred: starredIds.has(set.id),
  }))
}

function getCurrentVaultSearchItems(set?: ResourceSet): VaultSearchItem[] {
  if (!set) return []

  const spaces = [...set.spaces]
    .sort((left, right) => left.position - right.position)
    .map((space) => ({
      id: space.id,
      vaultId: set.id,
      spaceId: space.id,
      spaceName: space.name,
      title: space.name,
      kind: "space" as const,
      vaultName: set.name,
    }))
  const spacesById = new Map(set.spaces.map((space) => [space.id, space]))
  const resources = set.resources.flatMap((resource) => {
    const space = spacesById.get(resource.spaceId)
    if (!space) return []

    return {
      id: resource.id,
      vaultId: set.id,
      spaceId: resource.spaceId,
      spaceName: space.name,
      resourceId: resource.id,
      title: resource.title,
      kind: "resource" as const,
      vaultName: set.name,
    }
  })

  return [...spaces, ...resources]
}

function getGlobalSearchItems(
  sets: ResourceSet[],
  starredVaults: StarredVaultItem[],
  externalActiveSet: ResourceSet | null,
): VaultSearchItem[] {
  const cachedSets = [...sets]
  if (
    externalActiveSet &&
    !cachedSets.some((set) => set.id === externalActiveSet.id)
  ) {
    cachedSets.push(externalActiveSet)
  }

  const cachedItems = cachedSets.flatMap((set) => [
    {
      id: set.id,
      vaultId: set.id,
      title: set.name,
      kind: "vault" as const,
      vaultName: set.name,
    },
    ...getCurrentVaultSearchItems(set),
  ])
  const cachedVaultIds = new Set(cachedSets.map((set) => set.id))
  const uncachedStarredVaults = starredVaults
    .filter((vault) => !cachedVaultIds.has(vault.id))
    .map((vault) => ({
      id: vault.id,
      vaultId: vault.id,
      title: vault.title,
      kind: "vault" as const,
      vaultName: vault.title,
    }))

  return [...cachedItems, ...uncachedStarredVaults]
}

function scrollToWorkspaceTarget(id: string) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, 80)
}

function moveResourceInList(
  resources: Resource[],
  input: {
    resourceId: string
    sourceSpaceId: string
    targetSpaceId: string
    position: number
  }
) {
  const moving = resources.find((resource) => resource.id === input.resourceId)
  if (!moving) return resources

  const withoutMoving = resources.filter((resource) => resource.id !== input.resourceId)
  const targetResources = withoutMoving
    .filter((resource) => resource.spaceId === input.targetSpaceId)
    .sort((a, b) => a.position - b.position)
  const insertAt = Math.min(input.position, targetResources.length)
  const reorderedTarget = [
    ...targetResources.slice(0, insertAt),
    { ...moving, spaceId: input.targetSpaceId },
    ...targetResources.slice(insertAt),
  ].map((resource, index) => ({ ...resource, position: index }))
  let nextResources = withoutMoving
    .filter((resource) => resource.spaceId !== input.targetSpaceId)
    .concat(reorderedTarget)

  if (input.sourceSpaceId !== input.targetSpaceId) {
    const reorderedSource = nextResources
      .filter((resource) => resource.spaceId === input.sourceSpaceId)
      .sort((a, b) => a.position - b.position || b.createdAt.localeCompare(a.createdAt))
      .map((resource, index) => ({ ...resource, position: index }))

    nextResources = nextResources
      .filter((resource) => resource.spaceId !== input.sourceSpaceId)
      .concat(reorderedSource)
  }

  return nextResources
}

function moveSpaceInList(spaces: Space[], input: { spaceId: string; position: number }) {
  const moving = spaces.find((space) => space.id === input.spaceId)
  if (!moving) return spaces

  const withoutMoving = spaces
    .filter((space) => space.id !== input.spaceId)
    .sort((a, b) => a.position - b.position)
  const insertAt = Math.min(input.position, withoutMoving.length)

  return [
    ...withoutMoving.slice(0, insertAt),
    moving,
    ...withoutMoving.slice(insertAt),
  ].map((space, index) => ({ ...space, position: index }))
}

function toExportFileName(value: string) {
  const fallback = "nexus-vault-export"
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return normalized || fallback
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
