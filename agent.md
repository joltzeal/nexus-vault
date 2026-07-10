# NexusVault Agent 规范（agent.zh-CN.md）

## 项目定位

**NexusVault**

> GitHub for Shared Resources（共享资源的 GitHub）

NexusVault 不是磁力站，而是一个支持协作、讨论、分享与沉淀的资源知识库平台。

支持资源类型：

- Magnet
- 网盘链接
- HTTP/HTTPS 链接
- YouTube
- 其他资源类型

所有资源统一抽象为 Resource。

---

## 核心原则

优先级：

1. 可维护性
2. 简单性
3. Cloudflare 原生
4. Edge First
5. 可扩展性
6. 性能
7. 成本控制

禁止为了未来假想需求提前复杂化。

---

## 架构约束

V1 必须基于 Cloudflare 全家桶。

允许：

- Cloudflare Pages
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV
- Cloudflare R2
- Cloudflare Queues
- Cloudflare Turnstile
- Cloudflare Analytics Engine

V1 禁止：

- Kubernetes
- AWS
- GCP
- Vercel
- Supabase
- PostgreSQL
- MongoDB
- Redis
- 长驻服务器

例外：

Metadata Service 允许预留扩展接口，但 V1 不实现。

---

## 总体架构

Frontend（Next.js）

↓

Cloudflare Pages

↓

Workers API（Hono）

↓

D1

↓

KV / R2

↓

Queues

↓

Metadata Provider Interface

↓

External Metadata Service（未来实现）

---

## 统一资源模型

所有资源统一为 Resource。

类型：

- magnet
- onedrive
- google_drive
- dropbox
- alist
- http
- youtube
- other

禁止将 Magnet 逻辑写入核心领域。

---

## 核心领域

### Vault（资源库）

包含：

- Space
- Resource
- Collaborator
- Discussion

---

### Space（分区）

V1：

- 单层结构

V2：

- 支持嵌套

示例：

- 动漫
- 电影
- 教程
- 工具

---

### Resource（资源）

字段：

- id
- vault_id
- space_id
- type
- title
- description
- url
- metadata_status
- created_by
- created_at
- updated_at

---

### ResourceMetadata

Provider 元数据。

Magnet：

- info_hash
- size
- file_tree
- cover_image

其他 Provider 自行扩展。

---

### Collaborator（协作者）

角色：

- owner
- admin
- editor
- viewer

权限必须集中管理。

---

### Comment（评论）

要求：

- 无限嵌套
- 支持软删除
- V1 不实现历史版本

---

## Metadata 策略

必须异步。

流程：

提交资源

↓

立即创建 Resource

↓

metadata_status = pending

↓

Queue

↓

Metadata Provider

↓

更新 Metadata

状态：

- pending
- processing
- completed
- failed

V1：

仅实现占位 Provider。

禁止直接解析 DHT。

---

## 分享模型

可见性：

- public
- private
- password

密码：

仅存储 Hash。

禁止存储明文密码。

---

## Fork

Fork 保留：

- Space
- Resource
- Metadata 引用

Fork 不复制：

- 评论
- 协作者

必须记录来源。

---

## Star

一个用户只能 Star 一次。

计数允许冗余存储。

---

## 搜索

V1：

支持搜索：

- Vault 标题
- Resource 标题
- Tags

基于 D1。

不引入外部搜索引擎。

---

## 鉴权

Better Auth

V1：

- Email 登录

未来：

- Google
- GitHub
- Discord

---

## 防滥用

Turnstile：

- 注册
- 匿名评论
- 匿名提交

---

## 数据库原则

仅允许 D1。

规则：

- UUID
- Migration
- 不修改历史 Migration
- 禁止 SELECT *
- 显式索引
- created_at
- updated_at
- 优先软删除

---

## 存储策略

D1：

结构化数据

KV：

缓存

R2：

头像、封面、预览图

---

## Queue

用于：

- Metadata
- 通知
- 导入任务
- 预览生成

禁止阻塞 HTTP 请求。

---

## Durable Objects

V1 禁止。

V2 用于：

- 实时协作
- 在线状态
- 实时评论

---

## 前端

- Next.js App Router
- TypeScript
- shadcn/ui
- TailwindCSS
- Lucide
- React Hook Form
- Zod

---

## 后端

- Cloudflare Workers
- Hono
- Drizzle ORM
- D1
- Better Auth

---

## Monorepo

apps/
    frontend/
    workers/

packages/
    ui/
    db/
    auth/
    shared/
    providers/

docs/
scripts/

禁止循环依赖。

---

## API

REST First

前缀：

/api/v1

统一返回：

- success
- data
- error

分页：

优先 Cursor。

---

## Plan

Phase 1：

- Auth
- Vault
- Space
- Resource
- 分享
- 权限

Phase 2：

- 评论
- Star
- Fork
- 通知

Phase 3：

- Queue
- Metadata 抽象
- 占位 Provider

Phase 4：

- Magnet
- Drive
- URL Provider

Phase 5：

- 实时协作

---

## Load Map

开发顺序：

1. 项目初始化
2. Auth
3. Migration
4. Vault
5. Space
6. Resource
7. 分享
8. 权限
9. 评论
10. Star
11. Fork
12. Queue
13. Metadata 抽象
14. Provider
15. 通知
16. 实时协作

禁止跳步骤开发。

---

## AI Agent 规则

编码前必须完整阅读本文件。

如果用户需求与本文件冲突：

以本文件为准。

如果属于未来阶段：

只预留扩展点。

禁止提前实现。

优先简单设计。

未经明确批准，禁止引入 Cloudflare 之外的新基础设施。

本文件为 NexusVault 唯一事实来源（SSOT）。
