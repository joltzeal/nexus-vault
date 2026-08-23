# Nexus Vault for iOS

原生 SwiftUI iOS 客户端，包含系统 Share Extension。主应用负责登录和选择默认 Vault；扩展从 Twitter/X、抖音、TikTok、浏览器等应用接收 URL 或“文案 + URL”，然后调用现有 Nexus Vault API 创建资源。

## 当前功能

- Better Auth 邮箱密码登录
- App 与 Share Extension 通过 App Group 共享会话 Cookie
- 拉取当前账号的 Vault，设置系统分享的默认目标
- 在系统分享面板显示“添加到 Nexus Vault”
- 自动识别 URL、纯文本中的短链接，并优先选择 Twitter/X、抖音/TikTok 链接
- 分享前可修改目标 Vault、标题和备注
- 调用 `POST /api/v1/resources` 保存，资源类型和元数据继续由现有后端识别

## 运行

1. 用 Xcode 打开 `NexusVault.xcodeproj`。
2. 在 `NexusVault`、`ShareExtension` 和 `ActionExtension` 的 Signing & Capabilities 中选择同一个 Team。
3. 确认三个 Target 都启用了 App Groups，并包含 `group.com.nexusvault.shared`。
4. 运行 `NexusVault`，在登录页输入生产环境已有账号。iOS 客户端固定连接 `https://nexus-vault.stacklabs.space`。
5. 登录后选择一个默认 Vault。随后在 Twitter、抖音或 Safari 中打开系统分享面板，选择“添加到 Nexus Vault”。首次使用时可能需要在分享面板的“更多”中启用它。

## 标识与发布

工程默认使用：

- App Bundle ID: `com.nexusvault.ios`
- Extension Bundle ID: `com.nexusvault.ios.share`
- App Group: `group.com.nexusvault.shared`

正式发布前请换成团队持有的反向域名。修改 App Group 时，需要同步更新：

- `Config/Shared.xcconfig` 中的 `NEXUS_APP_GROUP`
- `Shared/AppGroup.swift` 中的 `identifier`
- Apple Developer 后台以及两个 Target 的 App Groups capability

如果生产环境启用了 Cloudflare Turnstile，当前原生邮箱密码请求不会生成浏览器 Turnstile token。上线前应为移动端加入设备证明/原生挑战兑换接口，或采用受控的 Web 登录回调，不能直接为移动端关闭认证保护。

## 命令行验证

```bash
xcodebuild \
  -project NexusVault.xcodeproj \
  -scheme NexusVault \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build/DerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build
```
