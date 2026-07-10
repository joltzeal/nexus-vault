"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@nexus-vault/auth/client"
import { toast } from "sonner"

import { apiRequest } from "@/features/vault-workspace/api-client"
import {
  CreateResourceDialog,
  CreateSetDialog,
  CreateSpaceDialog,
} from "@/features/vault-workspace/components/vault-dialogs"
import {
  ResourceDetailsSheet,
  type ResourceDetailsForm,
} from "@/features/vault-workspace/components/resource-details-sheet"
import { ShareSubmissionDialog } from "@/features/vault-workspace/components/share-submission-dialog"
import { VaultDocument } from "@/features/vault-workspace/components/vault-document"
import {
  type CollaboratorForm,
  type CollaboratorItem,
  type CommentItem,
  type NotificationItem,
  type SettingsTab,
  type ShareSettings,
  type StarredVaultItem,
  VaultSettingsSheet,
} from "@/features/vault-workspace/components/vault-settings-sheet"
import { VaultSidebar } from "@/features/vault-workspace/components/vault-sidebar"
import { VaultTopbar } from "@/features/vault-workspace/components/vault-topbar"
import { formatResourceType } from "@/features/vault-workspace/formatters"
import { mapVaultDetail, mapVaultListItem } from "@/features/vault-workspace/mappers"
import {
  emptyResourceForm,
  emptySetForm,
  emptySpaceForm,
  type Resource,
  type ResourceSubmissionItem,
  type ResourceSet,
  type Space,
  type VaultWorkspaceInitialData,
  type Visibility,
} from "@/features/vault-workspace/types"

export function VaultWorkspaceClient({
  initialData,
}: {
  initialData: VaultWorkspaceInitialData
}) {
  const router = useRouter()
  const session = authClient.useSession()
  const [sets, setSets] = useState<ResourceSet[]>(initialData.sets)
  const [activeSetId, setActiveSetId] = useState(initialData.activeSetId)
  const [query, setQuery] = useState("")
  const [setDialogOpen, setSetDialogOpen] = useState(false)
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false)
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const [resourceDetailsOpen, setResourceDetailsOpen] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState(
    initialData.sets.find((set) => set.id === initialData.activeSetId)?.resources[0]?.id ?? ""
  )
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState(initialData.error ?? "")
  const [setForm, setSetForm] = useState(emptySetForm)
  const [spaceForm, setSpaceForm] = useState(emptySpaceForm)
  const [editingSpaceId, setEditingSpaceId] = useState("")
  const [resourceForm, setResourceForm] = useState(emptyResourceForm)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("share")
  const [share, setShare] = useState<ShareSettings>({ visibility: "private" })
  const [sharePassword, setSharePassword] = useState("")
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [collaboratorForm, setCollaboratorForm] = useState<CollaboratorForm>({
    email: "",
    name: "",
    role: "viewer",
  })
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentBody, setCommentBody] = useState("")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [starredVaults, setStarredVaults] = useState<StarredVaultItem[]>([])
  const [submissions, setSubmissions] = useState<ResourceSubmissionItem[]>([])
  const toastedMetadataFailureIds = useRef<Set<string>>(new Set())

  const currentUser =
    session.data?.user ??
    (initialData.actorEmail
      ? { email: initialData.actorEmail, name: initialData.actorName }
      : undefined)
  const currentUserName = currentUser?.name ?? ""
  const activeSet = sets.find((set) => set.id === activeSetId) ?? sets[0]

  const filteredResources = useMemo(() => {
    const resources = activeSet?.resources ?? []
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return resources

    return resources.filter((resource) =>
      [
        resource.title,
        resource.url,
        resource.description,
        resource.metadata?.data?.title,
        activeSet?.spaces.find((space) => space.id === resource.spaceId)?.name ?? "",
        formatResourceType(resource.type),
        resource.metadataStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [activeSet, query])

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
  const totalResources = sets.reduce((count, set) => count + set.resources.length, 0)
  const isVaultOwner = collaborators.some(
    (collaborator) =>
      collaborator.role === "owner" && collaborator.email === currentUser?.email
  )

  useEffect(() => {
    document.title = activeSet?.name ? `${activeSet.name} · NexusVault` : "NexusVault"
  }, [activeSet?.name])

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
    if (!currentUser || !activeSet?.id) {
      setShare({ visibility: activeSet?.visibility ?? "private" })
      setCollaborators([])
      setNotifications([])
      setUnreadNotificationCount(0)
      setStarredVaults([])
      setSubmissions([])
      return
    }

    void loadVaultPanels(activeSet.id)
  }, [activeSet?.id, currentUser?.email])

  useEffect(() => {
    if (!currentUser || !activeSet?.id || !selectedResource?.id) {
      setComments([])
      return
    }

    void loadComments(activeSet.id, selectedResource.id)
  }, [activeSet?.id, currentUser?.email, selectedResource?.id])

  useEffect(() => {
    if (!currentUser || !activeSet?.id || !isVaultOwner) return

    const intervalId = window.setInterval(() => {
      void refreshVaultAlerts(activeSet.id)
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [activeSet?.id, currentUser?.email, isVaultOwner])

  async function loadVaults(nextActiveSetId?: string) {
    setIsLoading(true)
    setApiError("")

    try {
      const data = await apiRequest<{
        items: Array<{
          id: string
          title: string
          description: string
          visibility: Visibility
          collectionEnabled: boolean
          ownerName: string | null
          starCount: number
          forkCount: number
          createdAt: string
        }>
      }>("/vaults")
      const listItems = data.items.map(mapVaultListItem)
      const targetId =
        nextActiveSetId && listItems.some((set) => set.id === nextActiveSetId)
          ? nextActiveSetId
          : listItems.some((set) => set.id === activeSetId)
            ? activeSetId
            : listItems[0]?.id

      if (!targetId) {
        setSets([])
        setActiveSetId("")
        setSelectedResourceId("")
        return
      }

      const detail = await apiRequest<{
        vault: {
          id: string
          title: string
          description: string
          ownerName: string | null
          visibility: Visibility
          collectionEnabled: boolean
          starCount: number
          forkCount: number
          createdAt: string
        }
        spaces: Space[]
        resources: Array<Resource & { spaceId: string | null }>
      }>(`/vaults/${targetId}`)
      const hydratedSet = {
        ...mapVaultDetail(detail),
        isStarred: starredVaults.some((vault) => vault.id === detail.vault.id),
      }

      setSets((currentSets) =>
        markStarredSets(
          mergeVaultListWithExisting(listItems, currentSets, hydratedSet),
          starredVaults
        )
      )
      setActiveSetId(hydratedSet.id)
      setSelectedResourceId(hydratedSet.resources[0]?.id ?? "")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API request failed.")
    } finally {
      setIsLoading(false)
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
    const notificationRequest = apiRequest<{ items: NotificationItem[] }>(
      "/notifications"
    ).catch((reason: unknown) => {
      console.warn("Failed to load notifications.", reason)
      return null
    })
    const notificationSummaryRequest = apiRequest<{ unreadCount: number }>(
      "/notifications/summary"
    ).catch((reason: unknown) => {
      console.warn("Failed to load notification summary.", reason)
      return null
    })
    const starredRequest = apiRequest<{ items: StarredVaultItem[] }>("/stars").catch(
      (reason: unknown) => {
        console.warn("Failed to load starred vaults.", reason)
        return null
      }
    )
    const submissionRequest = apiRequest<{ items: ResourceSubmissionItem[] }>(
      `/vaults/${vaultId}/submissions?status=pending`
    ).catch((reason: unknown) => {
      console.warn("Failed to load resource submissions.", reason)
      return null
    })
    const [
      shareData,
      collaboratorData,
      notificationData,
      notificationSummary,
      starredData,
      submissionData,
    ] =
      await Promise.all([
        shareRequest,
        collaboratorRequest,
        notificationRequest,
        notificationSummaryRequest,
        starredRequest,
        submissionRequest,
      ])

    setShare(shareData?.share ?? { visibility: fallbackVisibility })
    if (collaboratorData) setCollaborators(collaboratorData.items)
    if (notificationData) setNotifications(notificationData.items)
    if (notificationSummary) setUnreadNotificationCount(notificationSummary.unreadCount)
    if (starredData) {
      setStarredVaults(starredData.items)
      setSets((currentSets) => markStarredSets(currentSets, starredData.items))
    }
    if (submissionData) setSubmissions(submissionData.items)
  }

  async function refreshVaultAlerts(vaultId: string) {
    const notificationRequest = apiRequest<{ items: NotificationItem[] }>(
      "/notifications"
    ).catch((reason: unknown) => {
      console.warn("Failed to refresh notifications.", reason)
      return null
    })
    const notificationSummaryRequest = apiRequest<{ unreadCount: number }>(
      "/notifications/summary"
    ).catch((reason: unknown) => {
      console.warn("Failed to refresh notification summary.", reason)
      return null
    })
    const submissionRequest = apiRequest<{ items: ResourceSubmissionItem[] }>(
      `/vaults/${vaultId}/submissions?status=pending`
    ).catch((reason: unknown) => {
      console.warn("Failed to refresh resource submissions.", reason)
      return null
    })
    const [notificationData, notificationSummary, submissionData] = await Promise.all([
      notificationRequest,
      notificationSummaryRequest,
      submissionRequest,
    ])

    if (notificationData) setNotifications(notificationData.items)
    if (notificationSummary) setUnreadNotificationCount(notificationSummary.unreadCount)
    if (submissionData) setSubmissions(submissionData.items)
  }

  async function loadComments(vaultId: string, resourceId: string) {
    try {
      const data = await apiRequest<{ items: CommentItem[] }>(
        `/vaults/${vaultId}/resources/${resourceId}/comments`
      )
      setComments(data.items)
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
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to save share settings.")
    }
  }

  async function handleSaveCollaborator() {
    if (!activeSet) return

    try {
      setApiError("")
      await apiRequest(`/vaults/${activeSet.id}/collaborators`, {
        method: "POST",
        body: JSON.stringify({
          email: collaboratorForm.email.trim(),
          name: collaboratorForm.name.trim() || undefined,
          role: collaboratorForm.role,
        }),
      })
      setCollaboratorForm({ email: "", name: "", role: "viewer" })
      await loadVaultPanels(activeSet.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to save collaborator.")
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

  async function handleForkVault() {
    if (!activeSet) return
    if (!currentUser) {
      toast.info("请先登录后再 fork vault。")
      return
    }

    try {
      const result = await apiRequest<{ id: string; forkId: string }>(
        `/vaults/${activeSet.id}/fork`,
        {
          method: "POST",
        }
      )
      toast.success("已复制一份到你的 vaults。")
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

  async function handleOpenNotifications() {
    if (!currentUser) return

    try {
      const data = await apiRequest<{ items: NotificationItem[] }>("/notifications")
      const unreadIds = data.items
        .filter(
          (notification) =>
            notification.type === "resource_submission.created" && !notification.readAt
        )
        .map((notification) => notification.id)
      const readAt = new Date().toISOString()

      setNotifications(
        data.items.map((notification) =>
          unreadIds.includes(notification.id) ? { ...notification, readAt } : notification
        )
      )
      setUnreadNotificationCount(0)

      await Promise.all(
        unreadIds.map((notificationId) =>
          apiRequest(`/notifications/${notificationId}/read`, {
            method: "PATCH",
            body: JSON.stringify({}),
          })
        )
      )
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load notifications.")
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
    setActiveSetId("")
    setSelectedResourceId("")
    router.refresh()
  }

  async function handleCreateSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = setForm.name.trim()
    if (!name) return

    try {
      setApiError("")
      const created = await apiRequest<{ id: string; defaultSpaceId: string }>("/vaults", {
        method: "POST",
        body: JSON.stringify({
          title: name,
          description: setForm.description.trim(),
          visibility: setForm.visibility === "password" ? "private" : setForm.visibility,
        }),
      })

      setSetForm(emptySetForm)
      setSetDialogOpen(false)
      await loadVaults(created.id)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to create vault.")
    }
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
    const url = resourceForm.url.trim()
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
      setApiError(error instanceof Error ? error.message : "Failed to create resource.")
    }
  }

  function openResourceDialog() {
    setResourceForm((form) => ({
      ...form,
      spaceId: activeSet?.spaces[0]?.id ?? "",
    }))
    setResourceDialogOpen(true)
  }

  function openResourceDialogForSpace(spaceId: string) {
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
    } catch (error) {
      setSets(previousSets)
      setApiError(error instanceof Error ? error.message : "Failed to update resource.")
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
      await Promise.all(
        resourcesToPersist.map((resource) =>
          apiRequest(`/resources/${resource.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              spaceId: resource.spaceId,
              position: resource.position,
            }),
          })
        )
      )
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
      await Promise.all(
        nextSpaces.map((space) =>
          apiRequest(`/vaults/${activeSet.id}/spaces/${space.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              position: space.position,
            }),
          })
        )
      )
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

  return (
    <main className="fixed inset-0 grid h-dvh grid-cols-1 grid-rows-[52px_1fr] overflow-hidden bg-background text-foreground lg:grid-cols-[236px_1fr]">
      <VaultTopbar
        currentUserName={currentUserName}
        isSignedIn={Boolean(currentUser)}
        isSessionPending={session.isPending}
        notifications={notifications}
        onAuthOpen={() => router.refresh()}
        onNotificationsOpen={() => void handleOpenNotifications()}
        onQueryChange={setQuery}
        onSignOut={handleSignOut}
        query={query}
        unreadNotificationCount={unreadNotificationCount}
      />
      <VaultSidebar
        activeSetId={activeSet?.id ?? ""}
        disabled={!currentUser}
        onCreateVault={() => setSetDialogOpen(true)}
        onSelectVault={(id) => void loadVaults(id)}
        sets={sets}
        starredVaults={starredVaults}
        totalResources={totalResources}
      />
      <div className="h-full min-h-0 overflow-hidden">
        <VaultDocument
          activeSet={visibleActiveSet}
          collaboratorsCount={collaborators.length}
          commentBody={commentBody}
          comments={comments}
          isSignedIn={Boolean(currentUser)}
          isVaultOwner={isVaultOwner}
          onAddResource={openResourceDialog}
          onAddResourceToSpace={openResourceDialogForSpace}
          onAddSpace={openCreateSpaceDialog}
          onCommentBodyChange={setCommentBody}
          onDeleteResource={handleDeleteResource}
          onDeleteSpace={handleDeleteSpace}
          onFocusResourceComments={setSelectedResourceId}
          onForkVault={handleForkVault}
          onMoveResource={handleMoveResource}
          onOpenSettings={openSettings}
          onRequireSignIn={handleRequireSignIn}
          onReorderSpace={handleReorderSpace}
          onSelectResource={handleSelectResource}
          onSubmitComment={handleCreateComment}
          onToggleStar={handleToggleStar}
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
      </div>

      {isLoading && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-card border border-line bg-ink-850 px-4 py-3 text-sm shadow-pop">
          <p className="text-fg-muted">正在加载本地 D1 数据...</p>
        </div>
      )}

      <VaultSettingsSheet
        activeTab={settingsTab}
        canDeleteVault={isVaultOwner}
        collectionEnabled={activeSet?.collectionEnabled ?? false}
        collaboratorForm={collaboratorForm}
        collaborators={collaborators}
        isBusy={isLoading}
        onCollaboratorFormChange={setCollaboratorForm}
        onCollectionEnabledChange={(enabled) => void handleToggleCollection(enabled)}
        onOpenChange={setSettingsOpen}
        onSubmitCollaborator={handleSaveCollaborator}
        onSubmitShare={handleSaveShare}
        onApproveSubmission={handleApproveSubmission}
        onDeleteVault={handleDeleteVault}
        onRejectSubmission={handleRejectSubmission}
        onTabChange={setSettingsTab}
        onVisibilityChange={(visibility) => setShare((value) => ({ ...value, visibility }))}
        open={settingsOpen}
        password={sharePassword}
        setPassword={setSharePassword}
        share={share}
        spaces={activeSet?.spaces ?? []}
        submissions={submissions}
      />

      <ResourceDetailsSheet
        canEdit={Boolean(currentUser) && isVaultOwner}
        isBusy={isLoading}
        onOpenChange={setResourceDetailsOpen}
        onSave={handleUpdateResource}
        open={resourceDetailsOpen}
        resource={selectedResource}
        spaces={activeSet?.spaces ?? []}
      />

      <CreateSetDialog
        form={setForm}
        onFormChange={setSetForm}
        onOpenChange={setSetDialogOpen}
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
    </main>
  )
}

function mergeVaultListWithExisting(
  listItems: ResourceSet[],
  currentSets: ResourceSet[],
  hydratedSet: ResourceSet
) {
  const currentById = new Map(currentSets.map((set) => [set.id, set]))

  return listItems.map((item) => {
    if (item.id === hydratedSet.id) return hydratedSet

    const existing = currentById.get(item.id)
    if (!existing) return item

    return {
      ...item,
      spaces: existing.spaces,
      resources: existing.resources,
    }
  })
}

function markStarredSets(sets: ResourceSet[], starredVaults: StarredVaultItem[]) {
  const starredIds = new Set(starredVaults.map((vault) => vault.id))

  return sets.map((set) => ({
    ...set,
    isStarred: starredIds.has(set.id),
  }))
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
