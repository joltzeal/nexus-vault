# NexusVault Architecture (ARCHITECTURE.md)

## 1. Architecture Goals

- Cloudflare Native
- Edge First
- Maintainable
- Extensible
- Cost Efficient
- AI-Agent Friendly

NexusVault 是资源知识库，而非磁力站。

---

## 2. High Level Architecture

Users
↓
Cloudflare Pages (Next.js)
↓
Cloudflare Workers API (Hono)
↓
D1 / KV / R2
↓
Queues
↓
Metadata Provider Interface
↓
External Metadata Service (Future)

---

## 3. Monorepo

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

---

## 4. Frontend

Framework:
- Next.js App Router
- TypeScript

UI:
- shadcn/ui
- TailwindCSS
- Lucide

Validation:
- Zod
- React Hook Form

原则：
- Server Components 优先
- Server Actions 优先
- Client Component 最小化

---

## 5. Backend

Framework:
- Hono

Runtime:
- Cloudflare Workers

ORM:
- Drizzle ORM

Auth:
- Better Auth

API Prefix:
- /api/v1

---

## 6. Storage

D1:
- Users
- Vaults
- Spaces
- Resources
- Comments
- Permissions

KV:
- Metadata Cache
- Vault Cache
- Rate Limits

R2:
- Avatars
- Covers
- Preview Images

Queues:
- Metadata
- Notifications

---

## 7. Domain Model

User
 ├─ Vault
 │   ├─ Space
 │   │   └─ Resource
 │   ├─ Collaborator
 │   └─ Comment
 ├─ Star
 └─ Session

---

## 8. Resource Abstraction

所有资源统一为 Resource。

type:
- magnet
- onedrive
- google_drive
- dropbox
- alist
- http
- youtube
- other

禁止核心逻辑依赖具体 Provider。

---

## 9. Metadata Architecture

提交资源
↓
创建 Resource
↓
metadata_status = pending
↓
Queue
↓
Provider
↓
Metadata
↓
更新 ResourceMetadata

状态：
- pending
- processing
- completed
- failed

V1：
占位实现。

V2：
接入 Metadata Service。

---

## 10. Sharing

visibility:
- public
- private
- password

password:
SHA256 Hash

---

## 11. Permission Matrix

Owner:
- 全权限

Admin:
- 管理成员
- 编辑资源

Editor:
- 编辑资源
- 评论

Viewer:
- 浏览
- 评论

Anonymous:
- 公开浏览

---

## 12. Comments

支持：
- 无限嵌套
- 软删除

V1：
最新版本内容。

V2：
编辑历史。

---

## 13. Fork

复制：
- Spaces
- Resources
- Metadata 引用

不复制：
- 评论
- 协作者

记录 forked_from_vault_id。

---

## 14. API Design

Response:

{
  success,
  data,
  error
}

分页：
Cursor Pagination

禁止：
SELECT *

---

## 15. Queue Consumers

metadata-worker:
- 获取 Metadata

notification-worker:
- 发送通知

future:
- import-worker
- refresh-worker

---

## 16. Durable Objects

V1:
禁止

V2:
- Presence
- Realtime Comment
- Collaboration

---

## 17. Security

Turnstile:
- 注册
- 匿名评论

Password:
Hash Only

日志：
禁止输出敏感信息。

---

## 18. Observability

Cloudflare Analytics

结构化日志：

{
  request_id,
  user_id,
  route,
  duration,
  status
}

禁止返回 Stack Trace。

---

## 19. Performance Principles

- Server Components 优先
- Cache First
- Queue 异步化
- 减少 D1 热点查询
- 显式索引

---

## 20. Evolution Roadmap

V1:
Vault + Resource

V2:
Metadata + Community

V3:
Realtime Collaboration

V4:
Multi Provider Ecosystem

V5:
Resource Knowledge Graph
