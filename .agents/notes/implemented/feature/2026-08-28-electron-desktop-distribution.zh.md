# Agent Note: Electron 桌面分发

Status: implemented

[English](2026-08-28-electron-desktop-distribution.md) | 中文

## Problem

随附的 Web profile 已提供完整的 Harness 图形界面，但用户必须启动 CLI 进程并保留浏览器标签页。桌面分发需要统一的应用生命周期，同时不能创建第二套 backend composition；而且从单一 host 为所有操作系统打包时，不能假定平台专用原生依赖可靠可用。

## Decision

`apps/desktop` 负责 Electron 外壳，其 main process 会通过 Electron 随附的 Node runtime 在 child process 中启动构建后的 `dsh web` entry。只有 backend 会收到 profile 实时配置 reload 所需的 Node `--expose-internals` flag；沙箱化 Renderer 不会获得任何 Node flag 或 API。该 profile 绑定操作系统分配的回环端口、禁止浏览器交接，并继续负责 readiness 与认证 URL 的构造。Electron 等待输出的 readiness URL 后才显示唯一的 `BrowserWindow`，并随应用生命周期终止 backend。Backend failure 会保留有长度限制的 stderr，并将其与退出码一起显示。

Desktop production dependencies 包含仓库中仅声明依赖的 Python deploy root；该 root 已枚举 CLI plugin 与 peer closure，并额外补齐其余 Web profile peer。因此 Electron 打包沿用一份受维护的 runtime inventory，而不是把 CLI 的 development dependencies 复制成第二份清单。

应用 resource 目录保持 unpacked。Profile 启动会从 `$DSH_HOME/profiles/node_modules` 创建指向安装 dependency closure 的普通 filesystem link；对 Node ESM resolver 而言，ASAR 虚拟路径不能作为这些 link 的目标。各平台 installer 仍会将 resource 目录作为应用产物的一部分进行压缩和签名。

Fallback healing 会把旧目标穿过无效虚拟 archive 的 owned link 视为 stale，并将其替换为当前安装目标。因此，从早期 ASAR build 升级时可以保留用户 profile 与 patch file，不需要手动清理 `$DSH_HOME`。

Desktop workspace 保持 private，因为其发布产物是 DMG、ZIP、NSIS 和 AppImage；npm 仅提供 build graph，且其 runtime closure 包含 private deployment-root package。Workspace constraint gate 记录这一应用专用例外，同时继续要求 CLI 与 Web application 满足发布规则。

Desktop patch 会把操作系统主目录传给其 host bootstrap plugin。该 plugin 在 client baseline 打开前，通过持久化 `WorkspaceRegistry` 注册这个现有目录。随后，既有 Workspace navigation policy 会创建或复用一个空 Session 并选中它，因此干净的 desktop profile 会直接显示可编辑 composer，而不是等待用户手动选择 Workspace。重复启动会复用规范化后的 Workspace 注册项。

早期 preview build 会存储 `agent-presets.default: code`，而随附 roster 将其后继项命名为 `standard`。Desktop main process 会在 backend 启动前执行这一精确且保留 comment 的 YAML migration。其他 preset id 保持不变。若没有该 migration，自动 Workspace 选择会在创建空 Session 时失败，并让 composer 停留在具有误导性的 Workspace-required 状态。

Renderer 保持沙箱隔离和 context isolation，不启用 Node.js 集成。一个窄化的 preload bridge 只公开 desktop platform、本地模型状态、状态变化订阅、下载、文件选择、停用和 onboarding-dismiss 操作；main process 会拒绝应用窗口以外任何 sender 的请求。Renderer 拒绝权限请求，将导航和子窗口限制在 backend origin 内，并把外部 HTTP 链接交给操作系统浏览器。单实例锁会把第二次启动导向现有窗口。

Main process 在沙箱化 Renderer 之外负责获取本地 GGUF。Desktop-only client plugin 会在首次启动时提供模型设置，并在 Models 设置页 footer 中提供下载、选择现有文件和停用操作；应用与托盘菜单提供对应的原生操作。开始下载受维护模型会立即完成 onboarding，并创建一个可跨 renderer navigation 和窗口隐藏到托盘继续运行的 main-process task。Main process 会向 renderer subscriber 发布限频后的 byte count，同时 Electron 保留原生 taskbar 或 dock progress；custom title bar 和 Models 设置页会显示 determinate 或 indeterminate progress。`node-llama-cpp` 通过 Hugging Face 下载模型，把完成的模型保存在 Electron user-data directory 下，也可以保留现有 GGUF 的绝对路径。选择或停用模型只会重启 Web-profile child；启用模型时，patch 会挂载 `dsh-llm-local`，为新 session 选择 `local/local-gguf`。Adapter 在请求之间保留模型权重，为每个请求分配独立 context，通过模型 chat template 转换 Harness tool history，并报告 llama.cpp token 数。

Icon source 是仓库的官方 DeepSeek whale vector，以白色渲染在产品蓝色背景上。Electron Builder 从 1024 像素 PNG 派生各平台 icon format，因此 installer、application bundle、运行进程与 tray entry 共用 Web 产品标志。`BrowserWindow` 会隐藏操作系统 title frame；desktop-only `shell.overlay` occupant 会提供可拖动应用 chrome、独立于原生 controls 居中产品标志、为内容保留空间，并继续显示原生 traffic lights 或 window buttons。关闭窗口会隐藏应用，而托盘会继续提供显示、模型管理和退出操作。

`electron-builder` 生成 DMG 与 ZIP、NSIS 和 AppImage 目标。分发 workflow 分别在 macOS、Windows 和 Linux 的原生 x64 与 ARM64 runner 上安装并构建 monorepo，使原生模块针对准确的操作系统与 architecture 组合完成安装。手动运行会将安装包保留为 workflow artifacts；`desktop-v*` tag 会把相同的矩阵产物收集到 GitHub Release。macOS 开发产物会获得明确的 ad-hoc 签名和 Electron runtime entitlement；受信任的公开发布会在发布环境中将该 identity 替换为 Developer ID identity，并增加 notarization。

## Verification

Desktop package 加入 pnpm workspace 和冻结 lockfile。仓库脚本会在开发启动或打包前构建普通 Harness 产物；如果某个操作系统系列没有生成预期 release 文件，CI matrix 会失败。

## Alternatives considered

**通过 `file://` 加载 SPA 并新增 IPC transport。** 本分发方案不采用此方式，因为随附应用已有带 startup injection、trust 和生命周期行为的认证 HTTP 与 WebSocket transport。并行 IPC transport 需要另一套 host composition 和 client connection 实现。

**在一台机器上交叉构建全部产物。** 不采用此方式，因为 Harness 包含原生 process、terminal、persistence 和 sandbox 依赖。使用各操作系统系列的原生 runner，可让安装和打包与实际执行产物的操作系统保持一致。

**从打包后的 launcher 打开系统浏览器。** 不采用此方式，因为它不能提供桌面窗口生命周期，并会把导航、权限和实例所有权交给无关的浏览器进程。

## Consequences

桌面应用复用受支持的 Web profile 及其设置、凭据和 frontend，而不改变 agent runtime。它获得单窗口启动、custom draggable chrome、托盘驻留、非阻塞首次启动本地设置、基于设置页的模型管理、空闲端口选择、原生安装包、设备本地 GGUF route 与品牌化平台 icon，同时在本地应用内保留回环 HTTP server。受维护的默认模型需要约 2.5 GB 下载，其 context 会消耗设备 RAM 或 VRAM；installer 不包含模型权重。本地 macOS 应用会通过签名结构验证，但仍不受系统信任且未经 notarization。发布自动化必须运行六个操作系统与 architecture 组合 job、替换 macOS ad-hoc identity，并为受信任的公开发布提供平台签名凭据。
