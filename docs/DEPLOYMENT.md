# Nexus Vault 部署文档

本文档记录 Nexus Vault 首次部署到 Cloudflare Workers 的流程。当前项目使用 Vite React SPA、Hono Worker API、Better Auth、Drizzle、Postgres/Neon、Cloudflare Hyperdrive、KV、R2 和 Queue。

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
# 默认关闭；设置为 true 后，已登录且具备资源创建权限的用户可上传图片、视频和音频到 R2。
ALLOW_RESOURCE_MEDIA_UPLOAD="true"
TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
TURNSTILE_ALLOWED_HOSTNAMES="localhost,127.0.0.1"
TIKHUB_API_TOKEN="<tikhub-api-token>"
```

生产环境建议把敏感变量写入 Cloudflare Worker secrets：

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put BETTER_AUTH_TRUSTED_ORIGINS --env production
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production

# Set these as production Worker variables in the Cloudflare dashboard:
# TURNSTILE_SITE_KEY=<production site key>
# TURNSTILE_ALLOWED_HOSTNAMES=nexus-vault.stacklabs.space
# The site key is public; the secret key must remain a Worker secret.
# Do not use the test keys above in production.
```

如果没有使用 Hyperdrive，也可以把 `DATABASE_URL` 设置为 Worker secret：

```bash
pnpm exec wrangler secret put DATABASE_URL --env production
```

当前代码会优先使用 Cloudflare `HYPERDRIVE` 绑定的连接串；如果没有绑定 Hyperdrive，才会回退到 `DATABASE_URL`。

### Metadata 服务

HTTP 页面和 GitHub resource 在 metadata 完成后会通过 Workers AI 生成摘要。`wrangler.jsonc` 已配置远程 `AI` binding，并默认使用 `@cf/meta/llama-3.1-8b-instruct-fp8`，请求经过 AI Gateway `default`，启用缓存、日志和最多三次网关重试。首次认证请求会自动创建该 Gateway，不需要保存额外 API Token。本地开发同样调用 Cloudflare 远程推理，因此运行 Wrangler 的账号必须已登录且具有 Workers AI 权限。

如需覆盖默认值，可在 Worker variables 中设置 `AI_GATEWAY_ID` 和 `AI_SUMMARY_MODEL`。摘要任务通过主 Queue 异步执行，流式结果会逐步写入 resource metadata，完成后写入 resource description。

GitHub metadata 支持匿名请求，但匿名 REST API 额度很低。生产环境应配置只读的 `GITHUB_TOKEN` Worker secret：

```bash
pnpm exec wrangler versions secret put GITHUB_TOKEN --env production
```

Token 不需要仓库写权限。公开用户、公开仓库和公开 Release 只需要读取公开信息的权限。未配置 Token 时 provider 仍可运行，但更容易触发 GitHub API 限流。

X Tweet 默认先通过 `react-tweet` 获取公开推文；受限推文会读取资源创建者在账户设置中保存的 X Cookie，并通过 `@the-convocation/twitter-scraper` 获取。当前不需要配置 X proxy 环境变量。X Profile 通过 `xprofilecards.com` 获取，第三方服务不可用时会保留 URL 可推导的 profile 简版信息。

Douyin/TikTok metadata 通过 TikHub `hybrid/video_data` 接口获取，并使用 `Authorization: Bearer <token>` 请求头鉴权。生产环境必须把 token 配置为 Worker secret，不要写入 `wrangler.jsonc` 的明文 `vars`：

```bash
pnpm exec wrangler versions secret put TIKHUB_API_TOKEN --env production
```

Telegram metadata 服务需要配置服务地址；使用鉴权时还需配置 Token：

```bash
pnpm exec wrangler versions secret put TELEGRAM_METADATA_API_TOKEN --env production
```

在 Cloudflare Dashboard 的 production Worker variables 中设置：

```txt
TELEGRAM_METADATA_API_URL=https://<telegram-metadata-service>
```

磁力 metadata 固定由 `https://magnet-metadata-api.darklyn.org/api/v1/metadata` 获取精确大小、文件数和目录树，WhatsLink 并行补充标题、文件类型和预览。无需配置 Magnet 服务地址或 Token，也不会接入仓库中的 `.local-services/magnet-metadata` sidecar。

Darklyn 解析可能耗时一到两分钟，因此 Magnet metadata 始终通过 Queue 异步处理。单次请求最多等待 165 秒，临时超时、限流或上游错误会由 Queue 重试；前端只读取最终写入数据库的 metadata，不会在卡片渲染时请求 Darklyn。

所有 provider 都在 Worker 中获取 metadata 并写入数据库，前端只读取持久化结果，不会在卡片渲染时动态请求 GitHub、X 或 Telegram。

### 本地媒体上传

`ALLOW_RESOURCE_MEDIA_UPLOAD` 缺失或不是 `true` 时，本地媒体上传入口和 API 都会关闭。启用后上传文件会存入 `MEDIA` R2 bucket，Resource 类型为 `local_media`，其主 URL 保持为空，并以 `local-media` metadata 写入 Resource；不会进入第三方 metadata provider 或 Queue。视频会在浏览器生成 JPEG 预览图并一同保存到 R2；预览图生成失败时对应 `thumbnailUrl` 保持为空。

生产环境可在 Cloudflare Dashboard 的 Worker variables 中设置 `ALLOW_RESOURCE_MEDIA_UPLOAD=true`。也可以作为 Worker secret 设置：

```bash
printf '%s' true | pnpm exec wrangler versions secret put ALLOW_RESOURCE_MEDIA_UPLOAD --env production
```

S3 endpoint、region、bucket、公开地址和 path style 配置作为明文变量保存在 `wrangler.jsonc`；访问密钥只通过 Worker secret 设置：

```bash
pnpm exec wrangler versions secret put S3_UPLOAD_ACCESS_KEY_ID --env production
pnpm exec wrangler versions secret put S3_UPLOAD_SECRET_ACCESS_KEY --env production
```

上传的媒体 URL 使用同源相对地址，不绑定当前域名；R2 object key 会保存在 metadata 中。浏览器通过 Uppy 将文件切成 10 MiB 分片，Worker 仅负责创建 multipart upload、生成 15 分钟有效的预签名 URL 以及完成上传，文件分片由浏览器直接写入 R2 S3 endpoint。当前每个文件和单次上传总量上限均为 1 GB，每次最多 20 个文件。

R2 bucket 必须为应用域名配置 CORS，允许 `PUT` 并暴露 `ETag` response header，否则 Uppy 无法收集完成 multipart upload 所需的 part ETag。

## 3. Cloudflare 资源

生产环境资源在 `wrangler.jsonc` 的 `env.production` 下配置。

当前绑定约定：

- `HYPERDRIVE`：生产 Postgres 连接，当前配置的 Hyperdrive ID 为 `3271a1cca21447d9bc4ba2ff47a167ff`
- `MEDIA`：R2 bucket，用于媒体文件
- `CACHE`：KV namespace，用于缓存注册状态和 Better Auth Cloudflare 插件
- `QUEUE`：Cloudflare Queue，用于异步元数据处理
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

启动本地 Cloudflare Worker，并使用构建后的 SPA 静态资源：

```bash
pnpm dev
```

如只需要调试前端界面，也可以启动 Vite 开发服务器：

```bash
pnpm dev:client
```

Worker 本地预览默认访问：

```txt
http://localhost:8787
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

`upload` 是当前部署脚本的别名：

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
