import type { Resource, ResourceSet, VaultWorkspaceInitialData } from "@/features/types"

export type WorkspaceViewer = {
  id: string
  email: string
  name: string | null
  image?: string | null
}

export type VaultAccess = {
  isSignedIn: boolean
  isVaultOwner: boolean
  isVaultEditor: boolean
  canAddResource: boolean
  canEditResource: boolean
}

export function getWorkspaceViewer(
  initialData: VaultWorkspaceInitialData,
): WorkspaceViewer | undefined {
  if (!initialData.actorId || !initialData.actorEmail) return undefined

  return {
    id: initialData.actorId,
    email: initialData.actorEmail,
    name: initialData.actorName ?? null,
  }
}

export function getVaultAccess(input: {
  activeSet?: ResourceSet | null
  currentUserId?: string
  selectedResource?: Resource
}): VaultAccess {
  const { activeSet, currentUserId, selectedResource } = input
  const isSignedIn = Boolean(currentUserId)
  const isVaultOwner =
    activeSet?.actorRole === "owner" ||
    Boolean(activeSet?.ownerId && currentUserId && activeSet.ownerId === currentUserId)
  const isVaultEditor = activeSet?.actorRole === "editor"

  return {
    isSignedIn,
    isVaultOwner,
    isVaultEditor,
    canAddResource: isVaultOwner || isVaultEditor,
    canEditResource:
      isVaultOwner ||
      Boolean(
        isVaultEditor &&
          selectedResource?.createdBy &&
          selectedResource.createdBy === currentUserId,
      ),
  }
}
