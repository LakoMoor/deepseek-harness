---
description: "用于 Workspace bootstrap、本地 GGUF 设置、进度和模型管理的 desktop-only title bar 与 controls。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-local-model-desktop

[English](README.md) | 中文

## 概述

本 package 由 `apps/desktop` 挂载。其 host entry 会将配置的启动目录注册为持久 Workspace，因此干净的 desktop profile 会直接打开可编辑的空 Session，无需手动选择 Workspace。当 Electron preload bridge 存在时，其 client entry 会注册 custom title bar、首次启动 onboarding step 和 Models 设置页 footer card。下载开始后会立即离开 onboarding，并在 Electron main process 中继续；title bar 与 Settings 会接收进度 event。模型界面可以下载受维护的 GGUF、选择现有 GGUF，并报告原生操作失败；Settings 还可以停用已选择的模型。普通 browser 不会得到任何 client 注册项。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

只在 isolated preload 定义了 `window.dshDesktop` 的 Electron composition 中，以现有的 `workspacePath` 挂载 host entry。Desktop patch 会提供操作系统主目录；browser-only composition 会省略本 package。

-----

<a id="understand-the-implementation"></a>
## 理解实现

Host entry 请求 `WorkspaceRegistry` 规范化并持久注册 `workspacePath`；重复启动会复用同一个 Workspace。Client 通过 slot injection face 接收窄化的 bridge。Electron 负责持久化、长生命周期 download task、进度发布、原生文件选择、sender validation 和 backend restart behavior；React component 负责 title-bar geometry 以及 pending、progress、result 与 failure presentation。

-----

<a id="further-exploration"></a>
## 进一步探索

- [Desktop 应用](../../../apps/desktop/README.zh.md)——应用生命周期、模型存储与打包。
- [Models 设置](../ui-settings-models/README.zh.md)——本 package 占据的设置 footer slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本 package 管理本地模型安装与选择，但不会向模型请求贡献内容。

#### KV Cache 影响

无；推理 context 由本地 LLM adapter 拥有，而不是此 UI package。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **仅限 Electron**——没有 preload bridge 时不会显示这些控件。
- **单一受管下载**——受维护模型下载期间，模型选择与停用控件保持不可用。

<a id="dev-note"></a>
### 开发备注

修改本 package 后运行 `pnpm exec vitest run packages/client/ui-local-model-desktop/tests/ui.client.spec.tsx --coverage --coverage.include='packages/client/ui-local-model-desktop/src/**/*.{ts,tsx}'`。
