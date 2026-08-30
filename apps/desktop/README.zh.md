# DeepSeek Harness Desktop

[English](README.md) | 中文

本应用通过 Electron 随附的 Node runtime 在 child process 中运行 `dsh web` profile，并在沙箱窗口中打开其带认证信息的回环地址。Renderer 不启用 Node.js 集成、拒绝权限请求、只允许在本地 Harness origin 内导航，并将外部 HTTP 链接交给操作系统浏览器。

## 使用体验

Desktop shell 提供原生应用窗口、居中的 custom title bar、应用与托盘图标、后台运行、本地 GGUF 模型设置，以及适用于各受支持操作系统和 architecture 的可下载安装包。

<p align="center"><img src="assets/screenshots/desktop-home.png" alt="DeepSeek Harness Desktop 主窗口" width="960"></p>

<table>
  <tr>
    <td><img src="assets/screenshots/desktop-first-run.png" alt="首次启动本地模型设置"></td>
    <td><img src="assets/screenshots/desktop-local-model-settings.png" alt="本地模型设置"></td>
  </tr>
</table>

## 开发

在仓库根目录安装依赖并构建 Harness，然后启动桌面外壳：

```sh
pnpm install
pnpm run desktop:dev
```

Backend 与普通 `dsh` 共用 home 和凭据，并以用户 home 目录作为初始工作目录。Backend 启动前，desktop launcher 会把 preview-era 的 `agent-presets.default: code` 设置迁移到其随附后继项 `standard`；其他 preset 选择保持不变。无边框 desktop window 使用带居中产品标志的可拖动应用 title bar，同时保留平台 window controls。关闭窗口会将其隐藏，tray process 与 backend 仍保持可用；请使用托盘菜单中的 **Quit** 操作或平台应用菜单停止应用。

首次启动会提示下载受维护的 Qwen3 4B Instruct Q4_K_M GGUF、选择现有 `.gguf` 文件或稍后设置。开始下载后，设置步骤会立即关闭：main process 会在用户浏览应用时继续下载，custom title bar 和 Models 设置页会显示实时进度。将窗口关闭到托盘不会停止下载。Models 设置页以及应用和托盘中的 **Local Model** 菜单之后会提供相同的模型操作。下载内容保存在应用 user-data directory 下。选择模型后只会重启内嵌的 Web-profile process，发布 `local/local-gguf` route，并将其用于新 session。模型权重保留在设备上；请求通过 `node-llama-cpp` 运行，并按已安装平台选择 Metal、CUDA、Vulkan 或 CPU 支持。

## 分发

请在目标操作系统上构建，使 Electron 与 Harness 的原生依赖和产物平台一致：

```sh
pnpm run desktop:dist:mac
pnpm run desktop:dist:win
pnpm run desktop:dist:linux
```

产物写入 `apps/desktop/release`。macOS 生成 DMG 与 ZIP，Windows 生成 NSIS 安装包，Linux 生成 AppImage。本地命令构建当前机器的 architecture；仓库 workflow 会分别在原生 runner 上为三个操作系统系列构建 x64 和 ARM64。macOS 开发产物使用有效的 ad-hoc 签名，因此应用可以在本地运行。受信任的公开发布必须在发布环境中用 Developer ID identity 替换已配置的 ad-hoc identity，并完成 notarization。

推送 `desktop-v*` tag 会运行原生构建矩阵，并将所有安装包附加到 GitHub Release。手动运行 workflow 会构建相同矩阵，并把安装包保存为 workflow artifacts，但不会发布 release。
