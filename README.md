# Nexus Vault

Next.js on Cloudflare Workers with PostgreSQL-backed authentication, Drizzle, Postgres, and Hyperdrive.

## Auth and Database

Local development reads the Postgres connection string from `.dev.vars`.

Production uses the Cloudflare Hyperdrive binding named `HYPERDRIVE`, configured in `wrangler.jsonc` under the `production` environment:

```txt
nexus-vault-postgres
3271a1cca21447d9bc4ba2ff47a167ff
```

Authentication reuses the existing `user`, `account`, `session`, and `verification` tables in `src/db/auth-schema.ts`. Password hashing and verification run inside PostgreSQL through `pgcrypto`; the Worker stores only random session tokens.

For this project, Drizzle owns applying schema changes. Because the local database is empty, push the schema directly:

```bash
pnpm db:push:local
```

After changing `wrangler.jsonc` bindings, regenerate Cloudflare types:

```bash
pnpm cf-typegen
```

Cloudflare resources are split by environment:

- Local development uses Wrangler's local simulators for `MEDIA`, `CACHE`, and `QUEUE`.
- Production uses the `production` environment in `wrangler.jsonc`.

Create the production resources if they do not exist yet:

```bash
pnpm exec wrangler r2 bucket create nexus-vault-media
pnpm exec wrangler kv namespace create CACHE --env production
pnpm exec wrangler queues create nexus-vault-queue
```

## Develop

Run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
pnpm preview
```

## Deploy

Deploy the application to Cloudflare:

```bash
pnpm deploy
```
