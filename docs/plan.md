# NexusVault Development Plan

## 0. Source of Truth

- Product direction: `agent.md`
- Architecture note: `docs/ARCHITECTURE.md`
- UI foundation: `src/app/globals.css`, `components.json`, `src/components/ui/*`
- Deployment target: Cloudflare Pages / Workers via OpenNext

NexusVault is "GitHub for Shared Resources": a collaborative resource knowledge base, not a magnet site. Every shared item must be modeled as a generic `Resource`; provider-specific behavior stays outside the core domain.

## 1. Current Initialization Check

- [x] Read `agent.md` and confirmed the required development order.
- [x] Checked the shadcn setup: `radix-nova`, RSC enabled, Tailwind v4, Lucide configured.
- [x] Checked the existing global CSS and design tokens.
- [x] Checked existing UI components under `src/components/ui`.
- [x] Checked current app entry files: `src/app/layout.tsx` and `src/app/page.tsx`.
- [x] Checked Cloudflare/OpenNext config: `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`.
- [x] Confirmed current homepage is a UI/design-system showcase, not yet the NexusVault product shell.
- [x] Noted initialization gaps and resolved the first backend set: D1/KV/R2/Queues bindings, Hono, Drizzle, Drizzle Kit, and Zod are now in place.

## 2. Product Effect I Will Build Toward

The first usable version should open directly into a dense, dark, work-focused resource vault interface:

- A left navigation rail for Vaults, Spaces, search, starred resources, and settings.
- A top command/search bar for quickly finding vaults, resources, tags, and URLs.
- A main resource table/list with title, type, visibility, metadata status, tags, owner, and updated time.
- A right detail panel for the selected resource, showing description, URL, metadata status, discussion summary, and permission actions.
- A primary "Add Resource" flow that supports magnet, cloud drive, HTTP/HTTPS, YouTube, and other resource types through one unified form.
- Status badges for `pending`, `processing`, `completed`, and `failed` metadata.
- Public/private/password sharing controls.
- A calm editorial-dark visual style using the existing tokens, but shaped like an operational tool rather than a landing page.

In short: the app should feel like a private GitHub-style workspace for shared resources, with fast scanning, clear permissions, and provider-neutral resource handling.

## 3. Development Rules

- Follow the `agent.md` Load Map. Do not skip ahead.
- Keep V1 Cloudflare-native: D1, KV, R2, Queues, Turnstile where needed.
- Prefer Server Components and Server Actions; use Client Components only for interactive controls.
- Use existing shadcn components before creating custom UI.
- Use semantic Tailwind tokens from `globals.css`; avoid raw color styling.
- Keep permissions centralized.
- Keep provider-specific metadata logic behind a provider interface.
- Do not parse DHT or implement real metadata providers in V1; use a placeholder provider.
- Do not modify historical migrations once created.
- Do not use `SELECT *`.

## 4. Phase Plan

### Phase 1: Project Initialization

- [x] Decide and migrate to the `apps/*` and `packages/*` monorepo shape from `agent.md`.
- [x] Align dependencies with the architecture: add Hono, Drizzle, Drizzle Kit, Zod, and remove or quarantine Prisma usage unless there is a deliberate reason to keep it.
- [x] Add initial environment documentation for Cloudflare bindings and local development.
- [x] Configure D1, KV, R2, and Queues bindings in `wrangler.jsonc`.
- [x] Create the initial domain folder layout for shared types, permissions, resource models, and API response helpers.
- [x] Split the API into thin Next route adapters, a Hono app, domain route modules, schema modules, and service modules.
- [x] Replace the design-system demo homepage with the NexusVault product shell.
- [x] Update metadata in `src/app/layout.tsx` from Create Next App defaults to NexusVault.
- [x] Add a minimal build/lint/typecheck verification path.

### Phase 2: Auth

- [x] Configure Better Auth for email login.
- [x] Define user/session tables in D1 migrations.
- [x] Add auth route handlers and server helpers.
- [x] Add protected app shell routing for write actions while preserving public reads.
- [x] Prepare Turnstile integration points for registration and future anonymous comments.

### Phase 3: Migration

- [x] Create Drizzle schema for User, Vault, Space, Resource, ResourceMetadata, Collaborator, Share, Star, Fork, Comment.
- [x] Add explicit indexes for search, ownership, visibility, resource type, and timestamps.
- [x] Add migration scripts for local D1 and remote D1.
- [x] Add seed data for local development.

### Phase 4: Vault

- [x] Implement Vault create/read/update/archive.
- [x] Add visibility model: public, private, password.
- [x] Add owner role assignment on creation.
- [x] Apply read filtering for public and collaborator-owned private vaults.
- [x] Add vault list and vault detail UI.

### Phase 5: Space

- [x] Implement single-level spaces for V1.
- [x] Implement Space create/update/archive APIs.
- [x] Add space navigation in the sidebar.
- [x] Keep the schema extensible for nested spaces in V2 without implementing nesting now.

### Phase 6: Resource

- [x] Implement the unified `Resource` model.
- [x] Add provider-neutral resource creation.
- [x] Add Resource update/archive APIs.
- [x] Add resource list, filters, type badges, tags, and detail panel.
- [x] Set `metadata_status = pending` immediately after creation.
- [x] Enqueue metadata work without blocking the request.

### Phase 7: Sharing

- [x] Implement public/private/password access checks.
- [x] Store only password hashes.
- [x] Add share settings UI.

### Phase 8: Permissions

- [x] Centralize role checks for owner, admin, editor, viewer, anonymous.
- [x] Apply permission helpers across API routes.
- [x] Replace local actor fallback with Better Auth session actor in production.
- [x] Add collaborator management UI.

### Phase 9: Comments

- [x] Implement nested comments with soft delete.
- [x] Add resource-level comment create/list/delete APIs with read permissions.
- [x] Add comment thread UI on resource detail.
- [x] Gate anonymous comments behind Turnstile by keeping V1 comments login-only and reserving Turnstile integration points.

### Phase 10: Star

- [x] Implement one-star-per-user constraint.
- [x] Add redundant star counts where useful.
- [x] Add starred resources view.

### Phase 11: Fork

- [x] Fork spaces and resources.
- [x] Preserve metadata rows for forked resources in V1.
- [x] Do not copy comments or collaborators.
- [x] Record fork source.

### Phase 12: Queue

- [x] Configure Cloudflare Queues for metadata tasks.
- [x] Add notification/import/preview queue placeholders.
- [x] Keep all queue work non-blocking.
- [x] Add a Worker queue consumer for metadata tasks.

### Phase 13: Metadata Abstraction

- [x] Define provider interface.
- [x] Add placeholder provider implementation.
- [x] Store provider results in `ResourceMetadata`.
- [x] Support status transitions: pending, processing, completed, failed.

### Phase 14: Provider

- [x] Add provider stubs for magnet, cloud drives, HTTP/HTTPS, YouTube, and other.
- [x] Keep real extraction out of V1 unless explicitly scoped later.

### Phase 15: Notifications

- [x] Add notification data model.
- [x] Add queue-backed notification creation.
- [x] Add in-app notification UI.

### Phase 16: Realtime Collaboration

- [x] Defer to V2.
- [x] Do not add Durable Objects in V1.

## 5. Next Implementation Slice

The backend is now split by API concern:

- `src/app/api/v1/[[...route]]/route.ts`: thin OpenNext/Cloudflare adapter only.
- `src/server/api/*`: Hono app assembly, middleware, actor resolution, validation, errors, and response envelopes.
- `src/server/routes/*`: one route module per domain area.
- `src/server/services/*`: D1/Drizzle business logic and permission enforcement.
- `src/server/schemas/*`: Zod request contracts.

Next production slices:

1. Harden the new monorepo package boundaries and reduce root dependency duplication.
2. Add focused API tests for auth, permissions, metadata queues, and notification queues.
3. Add richer collaborator/comment/notification UI polish once the current production panels are validated locally.
4. Add Turnstile runtime verification when anonymous comments or stricter registration protection is enabled.
5. Add richer queue observability and notification read/unread aggregation.

## 6. Check

- [x] `plan.md` created.
- [x] Current project state reviewed before planning.
- [x] Plan follows `agent.md` development order.
- [x] UI target effect defined.
- [x] Initialization gaps documented.
- [x] API routes decoupled into adapter/app/routes/services/schemas.
- [x] Production-grade D1 API gaps reviewed and corrected for the current backend slice.
