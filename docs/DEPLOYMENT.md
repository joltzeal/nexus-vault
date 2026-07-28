# Nexus Vault 部署文档

本文档记录 Nexus Vault 首次部署到 Cloudflare Workers 的流程。当前项目使用 Next.js、OpenNext for Cloudflare、Better Auth、Drizzle、Postgres/Neon、Cloudflare Hyperdrive、KV、R2 和 Queue。

## 1. 前置准备

本地需要安装：

- Node.js 20 或更高版本
- pnpm
- Cloudflare Wrangler 登录状态
- 可用的 Postgres 数据库，生产环境建议使用 Neon，并通过 Cloudflare Hyperdrive 连接

安装依赖：

```bash
pnpm install
```

登录 Cloudflare：

```bash
pnpm exec wrangler login
```

## 2. 环境变量

本地开发环境读取 `.dev.vars`。该文件不会提交到 Git。

本地最小配置示例：

```txt
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="local-or-dev-secret"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:3000"
ALLOW_USER_REGISTRATION="true"
TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
```

生产环境建议把敏感变量写入 Cloudflare Worker secrets：

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put BETTER_AUTH_TRUSTED_ORIGINS --env production
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

如果没有使用 Hyperdrive，也可以把 `DATABASE_URL` 设置为 Worker secret：

```bash
pnpm exec wrangler secret put DATABASE_URL --env production
```

当前代码会优先使用 Cloudflare `HYPERDRIVE` 绑定的连接串；如果没有绑定 Hyperdrive，才会回退到 `DATABASE_URL`。

## 3. Cloudflare 资源

生产环境资源在 `wrangler.jsonc` 的 `env.production` 下配置。

当前绑定约定：

- `HYPERDRIVE`：生产 Postgres 连接，当前配置的 Hyperdrive ID 为 `3271a1cca21447d9bc4ba2ff47a167ff`
- `MEDIA`：R2 bucket，用于媒体文件
- `CACHE`：KV namespace，用于缓存注册状态和 Better Auth Cloudflare 插件
- `QUEUE`：Cloudflare Queue，用于异步元数据处理
- `WORKER_SELF_REFERENCE`：OpenNext 自引用 service binding
- `IMAGES`：Cloudflare Images 绑定

如果资源还不存在，先创建：

```bash
pnpm exec wrangler r2 bucket create nexus-vault-media
pnpm exec wrangler kv namespace create CACHE --env production
pnpm exec wrangler queues create nexus-vault-queue
```

创建后把实际 ID 更新到 `wrangler.jsonc`。

修改绑定后，重新生成类型：

```bash
pnpm cf-typegen
```

## 4. 数据库初始化

首次部署且生产数据库为空时，不需要保留多段历史迁移。推荐从当前 Drizzle schema 生成一个干净的初始迁移。

生成 Better Auth 的 Drizzle schema：

```bash
pnpm auth:generate
```

生成 Drizzle 迁移：

```bash
pnpm db:generate
```

将 schema 应用到数据库：

```bash
pnpm db:push:local
```

说明：

- `pnpm db:generate` 会根据 `src/db/schema.ts` 生成 SQL 迁移文件。
- `pnpm db:push:local` 会读取 `drizzle.config.ts`，使用 `.dev.vars` 或 shell 中的 `DATABASE_URL` 连接数据库并推送当前表结构。
- 如果目标是生产数据库，请在执行前确认 `DATABASE_URL` 指向生产库，并确认这是首次初始化或允许覆盖结构。

## 5. 本地开发

启动 Next.js 开发服务器：

```bash
pnpm dev
```

默认访问：

```txt
http://localhost:3000
```

## 6. Cloudflare 预览

本地构建并使用 Cloudflare runtime 预览：

```bash
pnpm preview
```

生产环境配置预览：

```bash
pnpm preview:production
```

## 7. 部署

部署到 Cloudflare Workers 生产环境：

```bash
pnpm deploy
```

只上传构建产物但不立即切换流量：

```bash
pnpm upload
```

部署后检查：

- Worker 是否启动成功
- 登录、注册、退出是否正常
- `/api/auth/*` 是否能访问
- 数据库是否能读写
- R2 媒体读取是否正常
- Queue 消费者是否正常处理任务
- 私密分享页的 Turnstile 校验是否正常

## 8. 首次上线建议顺序

1. 创建 Neon 数据库。
2. 创建或确认 Cloudflare Hyperdrive，并把 ID 写入 `wrangler.jsonc`。
3. 创建 R2、KV、Queue，并把真实资源 ID 写入 `wrangler.jsonc`。
4. 配置生产 secrets。
5. 执行 `pnpm auth:generate`。
6. 执行 `pnpm db:generate`。
7. 对目标数据库执行 `pnpm db:push:local`。
8. 执行 `pnpm build`。
9. 执行 `pnpm deploy`。
10. 上线后将 `ALLOW_USER_REGISTRATION` 保持为 `false`，让系统进入首个用户可注册、之后仅登录的模式。

## 9. 注意事项

- 不要把 `.dev.vars`、数据库连接串、Better Auth secret 或 Turnstile secret 提交到 Git。
- 生产环境必须设置 `BETTER_AUTH_SECRET`，否则应用会在认证初始化时报错。
- 生产域名确定后，应在 `wrangler.jsonc` 的 `env.production.vars` 中设置 `BETTER_AUTH_URL`，并把同源地址加入 `BETTER_AUTH_TRUSTED_ORIGINS`。
- 如果生产数据库已经有真实数据，不要执行清空、drop 或无差别 push 操作。
- 如果这是第一次部署且数据库为空，保留单一初始迁移比保留多段开发期迁移更清晰。
