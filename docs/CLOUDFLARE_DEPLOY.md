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
rtk pnpm --filter @nexus-vault/frontend exec wrangler kv namespace create CACHE
rtk pnpm --filter @nexus-vault/frontend exec wrangler r2 bucket create nexus-vault-media
rtk pnpm --filter @nexus-vault/frontend exec wrangler queues create nexus-vault-metadata
rtk pnpm --filter @nexus-vault/frontend exec wrangler queues create nexus-vault-notifications
```

Copy the generated D1 database ID and KV namespace ID into
`apps/frontend/wrangler.jsonc` before deploying.

## Required Secrets

Set secrets through Wrangler or the Cloudflare dashboard. Do not commit these
values.

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put BETTER_AUTH_SECRET
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put SHARE_SECRET
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TURNSTILE_SECRET_KEY
```

Optional metadata provider secrets:

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TWITTER_COOKIE_STRING
rtk pnpm --filter @nexus-vault/frontend exec wrangler secret put TWITTER_REQUEST_PROXY_URL
```

Non-secret public values can be configured in `wrangler.jsonc` under `vars`,
for example `TURNSTILE_SITE_KEY`.

## Migrate And Deploy

```bash
rtk pnpm --filter @nexus-vault/frontend exec wrangler d1 migrations apply nexus-vault --remote
rtk pnpm deploy
```

`pnpm deploy` runs:

```bash
opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## Local Files

Keep local development secrets in `apps/frontend/.dev.vars`. The repository
`.gitignore` excludes `.dev.vars`, `.wrangler`, `.open-next`, `.next`, and
other generated deployment state.
