# Page Bridge

一个面向 Windows 与 macOS 的文件传输助手：通过邮件将电子书发送到 Kindle，或通过同一 Wi-Fi 将任意文件直接传到手机。

## 功能

- Kindle：持久化 SMTP 配置、多个 Kindle 收件邮箱、格式校验、批量附件发送。
- 手机：随机临时局域网地址、二维码接收页、不上传云端、不限制文件格式。
- 桌面发布：Windows NSIS 安装包；macOS Intel 与 Apple Silicon DMG。

> 手机浏览器访问本机地址和下载文件本身使用局域网 HTTP。这样无需公网信令或 TURN 服务，在 iOS/Android 浏览器上的兼容性也优于纯 WebRTC 文件通道；数据始终只在同一局域网内传输。

## 本地开发

需要 Node.js 22+：

```bash
npm install
npm run dev
```

检查和构建：

```bash
npm test
npm run typecheck
npm run dist
```

## 发布

1. 将 `package.json` 中的 `version` 更新为发布版本并提交。
2. 创建与推送 tag，例如：`git tag v0.1.0 && git push origin v0.1.0`。
3. GitHub Actions 会分别在 Windows 与 macOS runner 构建，并将 `.exe`、Intel `.dmg` 和 Apple Silicon `.dmg` 添加到 GitHub Release。

当前构建未配置代码签名。Windows 可能显示 SmartScreen 提示，macOS 可能显示“无法验证开发者”；面向公众正式发布时建议配置 Windows 代码签名证书和 Apple Developer ID/notarization。

## Kindle SMTP 提示

多数邮箱要求使用“SMTP 授权码”而非登录密码。还需在亚马逊「管理我的内容和设备 → 首选项 → 个人文档设置」中，将发件邮箱加入认可的发件人列表。

配置保存在 Electron 的系统用户数据目录中，不会提交到仓库或上传服务器。授权码目前由 Electron Store 存储；共享电脑上建议使用专用邮箱授权码，并及时撤销不再使用的授权。
