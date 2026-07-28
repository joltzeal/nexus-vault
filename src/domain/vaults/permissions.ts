export type CollaboratorRole = "owner" | "editor"

export type PermissionAction =
  | "vault:read"
  | "vault:update"
  | "vault:delete"
  | "space:create"
  | "space:update"
  | "space:delete"
  | "resource:create"
  | "resource:update"
  | "resource:delete"
  | "collaborator:manage"
  | "share:manage"
  | "fork:create"

function permissions(actions: PermissionAction[]) {
  return new Set<PermissionAction>(actions)
}

const rolePermissions: Record<CollaboratorRole, Set<PermissionAction>> = {
  owner: permissions([
    "vault:read",
    "vault:update",
    "vault:delete",
    "space:create",
    "space:update",
    "space:delete",
    "resource:create",
    "resource:update",
    "resource:delete",
    "collaborator:manage",
    "share:manage",
    "fork:create",
  ]),
  editor: permissions([
    "vault:read",
    "resource:create",
    "resource:update",
    "resource:delete",
    "fork:create",
  ]),
}

export function can(
  role: CollaboratorRole | "anonymous",
  action: PermissionAction,
) {
  if (role === "anonymous") return action === "vault:read"
  return rolePermissions[role].has(action)
}
