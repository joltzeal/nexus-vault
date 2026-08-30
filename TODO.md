# TODO

## Repository 层完整下沉

- [ ] 将 `worker/services` 中剩余的 Drizzle 查询逐步下沉到 `worker/repositories`。
- [ ] 为各业务实体补齐独立 Repository，并保持 Repository 只负责数据库访问。
- [ ] Service 保留业务规则、权限校验、事务编排，不直接依赖表结构查询。
- [ ] 为迁移后的 Repository 补充单元测试和关键 API 集成测试。

当前已完成核心 Repository：Resource、Vault、User、Space。
