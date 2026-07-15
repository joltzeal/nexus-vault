"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@nexus-vault/auth/client"
import { createCloudDriveUrlWithPassword } from "@nexus-vault/shared/resource-input"
import { toast } from "sonner"

import { apiRequest } from "@/features/vault-workspace/api-client"
import {
  AuthDialog,
  CreateResourceDialog,
  CreateSetDialog,
  CreateSpaceDialog,
} from "@/features/vault-workspace/components/vault-dialogs"
import {
  ResourceDetailsSheet,
  type ResourceDetailsForm,
} from "@/features/vault-workspace/components/resource-details-sheet"
import { ShareSubmissionDialog } from "@/features/vault-workspace/components/share-submission-dialog"
import { StarPage } from "@/features/vault-workspace/components/star-page"
import { VaultDocument } from "@/features/vault-workspace/components/vault-document"
import {
  type CollaboratorItem,
  type NotificationItem,
  type SettingsTab,
  type ShareSettings,
  type StarredVaultItem,
  VaultSettingsSheet,
} from "@/features/vault-workspace/components/vault-settings-sheet"
import { VaultSidebar } from "@/features/vault-workspace/components/vault-sidebar"
import {
  VaultTopbar,
  type VaultSearchItem,
} from "@/features/vault-workspace/components/vault-topbar"
import { mapVaultDetail, mapVaultListItem } from "@/features/vault-workspace/mappers"
import {
  emptyResourceForm,
  emptySetForm,
  emptySpaceForm,
  emptyAuthForm,
  type CommentItem,
  type AuthForm,
  type AuthMode,
  type Resource,
  type ResourceSubmissionItem,
  type ResourceSet,
  type Space,
  type StarredResourceItem,
  type VaultWorkspaceInitialData,
  type Visibility,
} from "@/features/vault-workspace/types"

type AuthPolicy = {
  allowSignUp: boolean
  reason: "public-registration" | "first-user" | "disabled"
}

type VaultAlerts = {
  notifications: NotificationItem[]
  pendingSubmissions: ResourceSubmissionItem[]
  unreadNotificationCount: number
}

const LOCAL_NSFW_STORAGE_KEY = "nexus-vault:nsfw-enabled"

export function VaultWorkspaceClient({
  initialData,
}: {
  initialData: VaultWorkspaceInitialData
}) {
  const router = useRouter()
  const session = authClient.useSession()
  const [sets, setSets] = useState<ResourceSet[]>(initialData.sets)
  const [externalActiveSet, setExternalActiveSet] = useState<ResourceSet | null>(null)
  const [activeSetId, setActiveSetId] = useState(initialData.activeSetId)
  const [activePage, setActivePage] = useState<"workspace" | "star">(() => {
    if (initialData.mode === "share") return "workspace"
    if (typeof window === "undefined") return "workspace"
    return new URLSearchParams(window.location.search).get("page") === "star"
      ? "star"
      : "workspace"
  })
  const [query, setQuery] = useState("")
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
  const [selectedResourceId, setSelectedResourceId] = useState(
    initialData.sets.find((set) => set.id === initialData.activeSetId)?.resources[0]?.id ?? ""
  )
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState(initialData.error ?? "")
  const [setForm, setSetForm] = useState(emptySetForm)
  const [setDialogMode, setSetDialogMode] = useState<"create" | "edit">("create")
  const [spaceForm, setSpaceForm] = useState(emptySpaceForm)
  const [editingSpaceId, setEditingSpaceId] = useState("")
  const [resourceForm, setResourceForm] = useState(emptyResourceForm)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("share")
  const [share, setShare] = useState<ShareSettings>({ visibility: "private" })
  const [sharePassword, setSharePassword] = useState("")
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [commentsByResourceId, setCommentsByResourceId] = useState<Record<string, CommentItem[]>>(
    () => getCommentsByResourceId(initialData.sets)
  )
  const [commentBody, setCommentBody] = useState("")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [starredVaults, setStarredVaults] = useState<StarredVaultItem[]>([])
  const [starredResources, setStarredResources] = useState<StarredResourceItem[]>([])
  const [submissions, setSubmissions] = useState<ResourceSubmissionItem[]>([])
  const [localNsfwEnabled, setLocalNsfwEnabled] = useState<boolean | null>(null)
  const toastedMetadataFailureIds = useRef<Set<string>>(new Set())

  const currentUser =
    session.data?.user ??
    (initialData.actorEmail
      ? { id: initialData.actorId, email: initialData.actorEmail, name: initialData.actorName }
      : undefined)
  const currentUserId = session.data?.user?.id ?? initialData.actorId
  const currentUserName = currentUser?.name ?? ""
  const ownedActiveSet = sets.find((set) => set.id === activeSetId)
  const activeSet =
    ownedActiveSet ??
    (externalActiveSet?.id === activeSetId ? externalActiveSet : null) ??
    sets[0]
  const isShareMode = initialData.mode === "share"
  const mediaVisible = activeSet
    ? localNsfwEnabled === null
      ? !activeSet.nsfwEnabled
      : !localNsfwEnabled
    : true
  const resolvingResourceIds =
    activeSet?.resources
      .filter(
        (resource) =>
          resource.metadataStatus === "pending" || resource.metadataStatus === "processing"
      )
      .map((resource) => resource.id)
      .join("|") ?? ""

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

  const selectedResource =
    activeSet?.resources.find((resource) => resource.id === selectedResourceId)
  const isVaultOwner = Boolean(
    activeSet?.ownerId && currentUserId && activeSet.ownerId === currentUserId
  )
  const isVaultEditor = activeSet?.actorRole === "editor"
  const canAddResource = isVaultOwner || isVaultEditor
  const canEditSelectedResource =
    isVaultOwner ||
    Boolean(isVaultEditor && selectedResource?.createdBy && selectedResource.createdBy === currentUserId)
  const currentUserImage =
    currentUser && "image" in currentUser && typeof currentUser.image === "string"
      ? currentUser.image
      : undefined

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
      setSubmissions([])
      return
    }

    void loadVaultPanels(activeSet.id)
  }, [activeSet?.id, currentUser?.email])

  useEffect(() => {
    if (!activeSet?.id || !selectedResource?.id) return
    void loadComments(activeSet.id, selectedResource.id)
  }, [activeSet?.id, selectedResource?.id])

  useEffect(() => {
    if (!currentUser || !activeSet?.id || !isVaultOwner) return

    const intervalId = window.setInterval(() => {
      void refreshVaultAlerts(activeSet.id)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [activeSet?.id, currentUser?.email, isVaultOwner])

  useEffect(() => {
    if (!currentUser || isShareMode || !activeSet?.id || !resolvingResourceIds) return

    const intervalId = window.setInterval(() => {
      void loadVaults(activeSet.id, {
        includeOpenedVaultInList: Boolean(ownedActiveSet),
        silent: true,
      })
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [activeSet?.id, currentUser?.email, isShareMode, ownedActiveSet?.id, resolvingResourceIds])

  async function loadVaults(
    nextActiveSetId?: string,
    options: {
      includeOpenedVaultInList?: boolean
      silent?: boolean
    } = {}
  ) {
    const includeOpenedVaultInList = options.includeOpenedVaultInList ?? true
    if (!options.silent) setIsLoading(true)
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
        setCommentsByResourceId({})
        setActiveSetId("")
        setSelectedResourceId("")
        return
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
      const hydratedSet = {
        ...mapVaultDetail(detail),
        isStarred: starredVaults.some((vault) => vault.id === detail.vault.id),
      }
      setCommentsByResourceId((current) => ({
        ...current,
        ...getCommentsByResourceId([hydratedSet]),
      }))

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
      setSelectedResourceId((currentResourceId) =>
        hydratedSet.resources.some((resource) => resource.id === currentResourceId)
          ? currentResourceId
          : hydratedSet.resources[0]?.id ?? ""
      )
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API request failed.")
    } finally {
      if (!options.silent) setIsLoading(false)
    }
  }

  async function loadVaultPanels(vaultId: string) {
    const fallbackVisibility =
      sets.find((set) => set.id === vaultId)?.visibility ?? activeSet?.visibility ?? "private"
    const shareRequest = apiRequest<{ share: ShareSettings | null }>(
      `/vaults/${vaultId}/share`
    ).catch((reason: unknown) => {
      console.warn("Failed to load vault share settings.", reason)
      return null
    })
    const collaboratorRequest = apiRequest<{ items: CollaboratorItem[] }>(
      `/vaults/${vaultId}/collaborators`
    ).catch((reason: unknown) => {
      console.warn("Failed to load vault collaborators.", reason)
      return null
    })
    const alertsRequest = apiRequest<VaultAlerts>(`/vaults/${vaultId}/alerts`).catch(
      (reason: unknown) => {
        console.warn("Failed to load vault alerts.", reason)
        return null
      }
    )
    const starredRequest = apiRequest<{ items: StarredVaultItem[] }>("/stars").catch(
      (reason: unknown) => {
        console.warn("Failed to load starred vaults.", reason)
        return null
      }
    )
    const starredResourceRequest = apiRequest<{ items: StarredResourceItem[] }>(
      "/resource-stars"
    ).catch((reason: unknown) => {
      console.warn("Failed to load starred resources.", reason)
      return null
    })
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

    setShare(shareData?.share ?? { visibility: fallbackVisibility })
    setCollaborators(collaboratorData?.items ?? [])
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
    const alerts = await apiRequest<VaultAlerts>(`/vaults/${vaultId}/alerts`).catch(
      (reason: unknown) => {
        console.warn("Failed to refresh vault alerts.", reason)
        return null
      }
    )

    if (!alerts) return

    setNotifications(alerts.notifications)
    setUnreadNotificationCount(alerts.unreadNotificationCount)
    setSubmissions(alerts.pendingSubmissions)
  }

  async function loadComments(vaultId: string, resourceId: string) {
    try {
      const data = await apiRequest<{ items: CommentItem[] }>(
        `/vaults/${vaultId}/resources/${resourceId}/comments`
      )
      setCommentsByResourceId((current) => ({
        ...current,
        [resourceId]: data.items,
      }))
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load comments.")
    }
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
      await loadVaultPanels(activeSet.id)
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

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!activeSet) return

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}/collaborators/${collaboratorId}`, {
        method: "DELETE",
      })
      await loadVaultPanels(activeSet.id)
      toast.success("Editor 已移除")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to remove collaborator.")
    }
  }

  async function handleCreateComment() {
    if (!activeSet || !selectedResource) return
    if (!currentUser) {
      handleRequireSignIn()
      return
    }

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}/resources/${selectedResource.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: commentBody.trim(),
        }),
      })
      setCommentBody("")
      await loadComments(activeSet.id, selectedResource.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to create comment.")
    }
  }

  function handleRequireSignIn() {
    toast.info("请先注册或登录后再评论。")
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
      await loadVaultPanels(activeSet.id)
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

      await apiRequest(`/vaults/${activeSet.id}/alerts/read`, {
        method: "PATCH",
        body: JSON.stringify({
          notificationIds: unreadIds,
        }),
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to update notifications.")
    }
  }

  async function handleSearchSelect(item: VaultSearchItem) {
    setActivePage("workspace")
    await loadVaults(item.vaultId, {
      includeOpenedVaultInList: item.kind !== "starred",
    })

    if (item.kind === "resource" && item.resourceId) {
      setSelectedResourceId(item.resourceId)
      scrollToWorkspaceTarget(`resource-${item.resourceId}`)
      return
    }

    if (item.kind === "space" && item.spaceId) {
      scrollToWorkspaceTarget(item.spaceId)
    }
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
      toast.success("Vault 已删除。")
      setSettingsOpen(false)
      setResourceDetailsOpen(false)
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

  async function handleSignOut() {
    await authClient.signOut()
    await session.refetch()
    setSets([])
    setExternalActiveSet(null)
    setActiveSetId("")
    setSelectedResourceId("")
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
    if (!email) return
    if (authMode !== "forgot-password" && !password) return
    if (authMode === "sign-up" && !authPolicy.allowSignUp) {
      setAuthError("注册已关闭。")
      return
    }
    if (authMode === "sign-up" && !name) return

    try {
      setAuthError("")
      if (authMode === "forgot-password") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
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
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password })

      if (result.error) {
        setAuthError(result.error.message ?? "认证失败，请稍后再试。")
        return
      }

      setAuthForm(emptyAuthForm)
      setAuthDialogOpen(false)
      await session.refetch()
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
    if (!name) return

    try {
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

    try {
      setApiError("")
      if (editingSpaceId) {
        await apiRequest(`/vaults/${activeSet.id}/spaces/${editingSpaceId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            description: spaceForm.description.trim(),
          }),
        })
      } else {
        const created = await apiRequest<{ id: string }>(`/vaults/${activeSet.id}/spaces`, {
          method: "POST",
          body: JSON.stringify({
            name,
            description: spaceForm.description.trim(),
          }),
        })
        setResourceForm((form) => ({ ...form, spaceId: created.id }))
      }

      setSpaceForm(emptySpaceForm)
      setEditingSpaceId("")
      setSpaceDialogOpen(false)
      await loadVaults(activeSet.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to create space.")
    }
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeSet) return

    const title = resourceForm.title.trim()
    const url = createCloudDriveUrlWithPassword(
      resourceForm.url,
      resourceForm.extractionCode
    )
    if (!url) return

    try {
      setApiError("")
      const created = await apiRequest<{ id: string }>(`/vaults/${activeSet.id}/resources`, {
        method: "POST",
        body: JSON.stringify({
          spaceId: resourceForm.spaceId || activeSet.spaces[0]?.id,
          ...(title ? { title } : {}),
          url,
          description: resourceForm.description.trim(),
        }),
      })

      setResourceForm(emptyResourceForm)
      setSelectedResourceId(created.id)
      setResourceDialogOpen(false)
      await loadVaults(activeSet.id)
      setSelectedResourceId(created.id)
      window.setTimeout(() => {
        void loadVaults(activeSet.id)
        setSelectedResourceId(created.id)
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create resource."
      setApiError(message)
      toast.error(message)
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
  }

  function openCreateSpaceDialog() {
    setSpaceForm(emptySpaceForm)
    setEditingSpaceId("")
    setSpaceDialogOpen(true)
  }

  function openEditSpaceDialog(space: Space) {
    setSpaceForm({
      name: space.name,
      description: space.description,
    })
    setEditingSpaceId(space.id)
    setSpaceDialogOpen(true)
  }

  function handleSelectResource(resourceId: string) {
    const resource = activeSet?.resources.find((item) => item.id === resourceId)
    if (!resource || isResourceResolving(resource.metadataStatus)) return

    const canEditResource =
      isVaultOwner ||
      Boolean(isVaultEditor && resource.createdBy && resource.createdBy === currentUserId)
    if (!canEditResource) return

    setSelectedResourceId(resourceId)
    setResourceDetailsOpen(true)
  }

  async function handleUpdateResource(form: ResourceDetailsForm) {
    if (!activeSet || !selectedResource) return

    const previousSets = sets
    const resourceId = selectedResource.id
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
                      url: form.url,
                      spaceId: form.spaceId,
                      metadataStatus:
                        form.url !== resource.url ? ("pending" as const) : resource.metadataStatus,
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
          url: form.url,
          spaceId: form.spaceId,
        }),
      })
      await loadVaults(activeSet.id)
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

  function handleHomeNavigation() {
    setActivePage("workspace")
    router.push("/")
  }

  function handleOpenConsole() {
    setActivePage("workspace")
    router.push("/")
  }

  function handleTopbarPageChange(page: "workspace" | "star") {
    if (isShareMode) {
      router.push(page === "star" ? "/?page=star" : "/")
      return
    }

    setActivePage(page)
    const nextUrl = page === "star" ? "/?page=star" : "/"
    window.history.replaceState(null, "", nextUrl)
  }

  return (
    <main className={`fixed inset-0 grid h-dvh grid-cols-1 grid-rows-[52px_1fr] overflow-hidden bg-background text-foreground ${isShareMode ? "" : "lg:grid-cols-[236px_1fr]"}`}>
      <VaultTopbar
        activePage={activePage}
        currentUserName={currentUserName}
        isSignedIn={Boolean(currentUser)}
        isSessionPending={session.isPending}
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
        onOpenConsole={handleOpenConsole}
        onPageChange={handleTopbarPageChange}
        onQueryChange={setQuery}
        onSearchSelect={(item) => void handleSearchSelect(item)}
        onSignOut={handleSignOut}
        query={query}
        searchEnabled={!isShareMode}
        showAuthEntry={authPolicy.reason !== "first-user"}
        unreadNotificationCount={unreadNotificationCount}
        vaultSearchItems={getVaultSearchItems(sets, starredVaults)}
      />
      {!isShareMode && (
        <VaultSidebar
          activeSetId={activeSet?.id ?? ""}
          disabled={!currentUser}
          mediaVisible={mediaVisible}
          onMediaVisibleChange={handleMediaVisibleChange}
          onCreateVault={openCreateVaultDialog}
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
      )}
      <div className="h-full min-h-0 overflow-hidden">
        {activePage === "star" && !isShareMode ? (
          <StarPage
            commentBody={commentBody}
            commentsByResourceId={commentsByResourceId}
            isSignedIn={Boolean(currentUser)}
            mediaVisible={mediaVisible}
            onCommentBodyChange={setCommentBody}
            onResourceUnstar={(sourceResourceId) =>
              void handleUnstarResourceFromStarPage(sourceResourceId)
            }
            resourceItems={starredResources}
          />
        ) : (
          <VaultDocument
            activeSet={visibleActiveSet}
            collaboratorsCount={collaborators.length + (activeSet ? 1 : 0)}
            commentBody={commentBody}
            commentsByResourceId={commentsByResourceId}
            canAddResource={canAddResource}
            currentUserId={currentUserId}
            isSignedIn={Boolean(currentUser)}
            isVaultEditor={isVaultEditor}
            isVaultOwner={isVaultOwner}
            isShareMode={isShareMode}
            mediaVisible={mediaVisible}
            onAddResource={openResourceDialog}
            onAddResourceToSpace={openResourceDialogForSpace}
            onAddSpace={openCreateSpaceDialog}
            onCommentBodyChange={setCommentBody}
            onDeleteResource={handleDeleteResource}
            onDeleteSpace={handleDeleteSpace}
            onDeleteVault={handleDeleteVault}
            onEditVault={openEditVaultDialog}
            onFocusResourceComments={setSelectedResourceId}
            onForkVault={handleForkVault}
            onMoveResource={handleMoveResource}
            onOpenSettings={openSettings}
            onReorderSpace={handleReorderSpace}
            onSelectResource={handleSelectResource}
            onSubmitComment={handleCreateComment}
            onToggleResourceStar={handleToggleResourceStar}
            onToggleStar={handleToggleStar}
            onToggleMediaVisibility={handleMediaVisibleChange}
            onEditSpace={openEditSpaceDialog}
            onUpdateSpaceIcon={handleUpdateSpaceIcon}
            pendingSubmissionCount={submissions.length}
            selectedResourceId={selectedResource?.id}
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

      {isLoading && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-card border border-line bg-ink-850 px-4 py-3 text-sm shadow-pop">
          <p className="text-fg-muted">正在加载...</p>
        </div>
      )}

      <VaultSettingsSheet
        activeTab={settingsTab}
        canDeleteVault={isVaultOwner}
        collectionEnabled={activeSet?.collectionEnabled ?? false}
        collaborators={collaborators}
        isBusy={isLoading}
        nsfwEnabled={activeSet?.nsfwEnabled ?? true}
        onCollectionEnabledChange={(enabled) => void handleToggleCollection(enabled)}
        onNsfwEnabledChange={(enabled) => void handleToggleVaultNsfw(enabled)}
        onOpenChange={setSettingsOpen}
        onRemoveCollaborator={(collaboratorId) => void handleRemoveCollaborator(collaboratorId)}
        onSubmitShare={handleSaveShare}
        onApproveSubmission={handleApproveSubmission}
        onDeleteVault={handleDeleteVault}
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
        isBusy={isLoading}
        onOpenChange={setResourceDetailsOpen}
        onSave={handleUpdateResource}
        open={resourceDetailsOpen}
        resource={selectedResource}
        spaces={activeSet?.spaces ?? []}
      />

      <CreateSetDialog
        form={setForm}
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
        form={spaceForm}
        mode={editingSpaceId ? "edit" : "create"}
        onFormChange={setSpaceForm}
        onOpenChange={(open) => {
          setSpaceDialogOpen(open)
          if (!open) {
            setSpaceForm(emptySpaceForm)
            setEditingSpaceId("")
          }
        }}
        onSubmit={handleCreateSpace}
        open={spaceDialogOpen}
      />
      <CreateResourceDialog
        form={resourceForm}
        onFormChange={setResourceForm}
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
      />
    </main>
  )
}

function isResourceResolving(status: Resource["metadataStatus"]) {
  return status === "pending" || status === "processing"
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

function getCommentsByResourceId(sets: ResourceSet[]) {
  const entries = sets.flatMap((set) =>
    set.resources.map((resource) => [resource.id, resource.comments ?? []] as const)
  )

  return Object.fromEntries(entries)
}

function getVaultSearchItems(
  sets: ResourceSet[],
  starredVaults: StarredVaultItem[]
): VaultSearchItem[] {
  const owned = sets.map((set) => ({
    id: set.id,
    vaultId: set.id,
    title: set.name,
    description: set.description,
    kind: "vault" as const,
  }))
  const spaces = sets.flatMap((set) =>
    set.spaces.map((space) => ({
      id: space.id,
      vaultId: set.id,
      spaceId: space.id,
      spaceName: space.name,
      title: space.name,
      description: space.description || set.name,
      kind: "space" as const,
      vaultName: set.name,
    }))
  )
  const resources = sets.flatMap((set) =>
    set.resources.map((resource) => {
      const space = set.spaces.find((item) => item.id === resource.spaceId)

      return {
        id: resource.id,
        vaultId: set.id,
        spaceId: resource.spaceId,
        spaceName: space?.name,
        resourceId: resource.id,
        title: resource.title,
        description: resource.description || resource.url,
        kind: "resource" as const,
        vaultName: set.name,
      }
    })
  )
  const ownedIds = new Set(owned.map((item) => item.id))
  const starred = starredVaults
    .filter((vault) => !ownedIds.has(vault.id))
    .map((vault) => ({
      id: vault.id,
      vaultId: vault.id,
      title: vault.title,
      description: vault.description,
      kind: "starred" as const,
      vaultName: vault.title,
    }))

  return [...resources, ...spaces, ...owned, ...starred]
}

function scrollToWorkspaceTarget(id: string) {
  window.setTimeout(() => {
    const target = document.getElementById(id)
    target?.scrollIntoView({
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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
