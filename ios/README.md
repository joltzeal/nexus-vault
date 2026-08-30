# Nexus Vault iOS

原生 SwiftUI 客户端（iOS 17+），生产 API 固定为 `https://nexus-vault.stacklabs.space`。

## 打开与运行

1. 在 macOS/Xcode 15+ 中打开 `NexusVault.xcodeproj`。
2. 将主 App、`ShareExtension`、`ActionExtension` 的 Signing Team 设置为你的开发者账号。
3. 在三个 Target 的 **Signing & Capabilities** 中添加同一个 App Group：`group.space.stacklabs.nexusvault`。
4. 运行 `NexusVault`。登录后可浏览 Vault、Space、Resource，并进行收藏、稍后查看和批注。

Share Extension 会出现在 Safari、照片、文件等系统分享面板中，Action Extension 出现在操作菜单。扩展从 App Group 读取默认 Vault（键名 `defaultVaultId`）；未配置时会提示选择/打开主 App 登录，可在主 App 设置中扩展默认 Vault 配置。

## 工程结构

- `NexusVault/Models.swift`：容错数据模型和请求 DTO。
- `NexusVault/APIClient.swift`：统一 URLSession、Cookie、状态码和错误映射。
- `NexusVault/NexusVaultApp.swift`：登录、四 Tab 导航、Vault/Space/Resource 界面。
- `NexusVault/MediaCache.swift`：基于 SHA-256 的媒体缓存与全屏分页预览。
- `ShareExtension` / `ActionExtension`：URL、文本和媒体分享入口，复用 APIClient。

所有网络请求都使用 `/api/v1` 与 Better Auth `/api/auth` 路由；新增服务端字段会被忽略，单个媒体解码失败不会影响其它资源。
