# Cloudflare Deploy

NexusVault deploys the Next.js frontend as an OpenNext Cloudflare Worker.

## Prerequisites

- Cloudflare account access through Wrangler.
- A GitHub repository named `nexus-vault`.
- Production Cloudflare resources:
  - D1 database: `nexus-vault`
  - KV namespace: `nexus-vault-cache`
  - R2 bucket: `nexus-vault-media`
  - Queues: `nexus-vault-metadata`, `nexus-vault-notifications`

## One-Time Cloudflare Setup

Run these commands from the repository root after logging in:

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler login
rtk pnpm --filter @nexus-vault/frontend exec wrangler d1 create nexus-vault
rtk pnpm --filter @nexus-vault/frontend exec wrangler kv namespace create nexus-vault-cache
rtk pnpm --filter @nexus-vault/frontend exec wrangler r2 bucket create nexus-vault-media
rtk pnpm --filter @nexus-vault/frontend exec wrangler queues create nexus-vault-metadata
rtk pnpm --filter @nexus-vault/frontend exec wrangler queues create nexus-vault-notifications
```

The default Wrangler bindings stay local for development. Production resources
are configured under `env.production` in `apps/frontend/wrangler.jsonc`. If
Wrangler asks for explicit IDs, add the generated D1/KV IDs to the commented
fields in that production environment, not to the default local bindings.

## Required Secrets

Set secrets through Wrangler or the Cloudflare dashboard. Do not commit these
values.

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put BETTER_AUTH_SECRET --env production
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put SHARE_SECRET --env production
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Optional metadata provider secrets:

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put BROWSERLESS_TOKEN --env production
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TWITTER_COOKIE_STRING --env production
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TWITTER_REQUEST_PROXY_URL --env production
```

Non-secret public values can be configured in `wrangler.jsonc` under `vars`,
for example `TURNSTILE_SITE_KEY`.

## Migrate And Deploy

```bash
rtk pnpm db:migrate:production
rtk pnpm deploy:production
```

`pnpm deploy:production` runs:

```bash
opennextjs-cloudflare build && opennextjs-cloudflare deploy --env production
```

## Local Files

Keep local development secrets in `apps/frontend/.dev.vars`. The repository
`.gitignore` excludes `.dev.vars`, `.wrangler`, `.open-next`, `.next`, and
other generated deployment state.
