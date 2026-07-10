# Local D1 Setup

This project uses Cloudflare D1 for structured data.

## Binding

The Worker binding is:

```txt
DB
```

Other V1 Cloudflare bindings are reserved in `wrangler.jsonc` for later local
integration:

```txt
CACHE
MEDIA
METADATA_QUEUE
NOTIFICATION_QUEUE
```

`METADATA_QUEUE` is now used by the Resource API. Creating a resource returns
immediately after D1 writes and schedules a metadata resolve message with
`executionCtx.waitUntil(...)`.

The local database name in `wrangler.jsonc` is:

```txt
nexus-vault-local
```

## First-Time Local Setup

For local-only development, apply migrations directly. Wrangler will keep the
local D1 state under its local development storage.

```bash
rtk pnpm db:migrate:local
```

Do not run remote creation/deploy commands for the local MVP.

When remote deployment is intentionally introduced later, create the remote D1
database and replace the placeholder `database_id` in `wrangler.jsonc`:

```bash
rtk wrangler d1 create nexus-vault
```

## API Surface

Current local REST endpoints:

```txt
GET  /api/v1/health
GET  /api/v1/vaults
POST /api/v1/vaults
GET  /api/v1/vaults/:vaultId
PATCH /api/v1/vaults/:vaultId
DELETE /api/v1/vaults/:vaultId
POST /api/v1/vaults/:vaultId/spaces
PATCH /api/v1/vaults/:vaultId/spaces/:spaceId
DELETE /api/v1/vaults/:vaultId/spaces/:spaceId
POST /api/v1/vaults/:vaultId/resources
GET  /api/v1/vaults/:vaultId/collaborators
POST /api/v1/vaults/:vaultId/collaborators
GET  /api/v1/vaults/:vaultId/share
PUT  /api/v1/vaults/:vaultId/share
GET  /api/v1/vaults/:vaultId/comments
POST /api/v1/vaults/:vaultId/comments
DELETE /api/v1/vaults/:vaultId/comments/:commentId
POST /api/v1/vaults/:vaultId/star
DELETE /api/v1/vaults/:vaultId/star
POST /api/v1/vaults/:vaultId/fork
PATCH /api/v1/resources/:resourceId
DELETE /api/v1/resources/:resourceId
POST /api/v1/resources/:resourceId/metadata/resolve
GET  /api/v1/notifications
```

## Local Actor

Until Better Auth is wired, API requests may identify the actor with either:

```txt
x-nexus-user-email: user@example.com
?userEmail=user@example.com
```

For local-only development, non-production requests without an explicit actor
fall back to:

```txt
local-owner@nexusvault.local
```

Production requests do not get this fallback and mutating endpoints require a
real actor with the correct Vault role.

Responses follow the project contract:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Errors use:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```
