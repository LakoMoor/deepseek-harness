# Agent Note: React Native Android client owns on-device inference

Status: implemented

[English](2026-09-04-react-native-android-client.md) | 中文

## Problem

Electron 应用会打包 Node runtime 与 desktop operating-system integrations，Android 无法直接承载这些内容。Mobile 应用仍需要有用的离线路径，同时不能在平台不兼容的 process launcher 后复制 Cordis backend，也不能把局部 backend 描述成完整 Harness。

## Decision

`apps/mobile` 是独立的 bare React Native Android 应用。它负责 mobile navigation、首次启动设置、应用私有存储、模型下载进度、持久化聊天消息，以及通过 `llama.rn` 进行设备端 GGUF 推理。推荐模型是官方 Qwen3 0.6B Q8 GGUF；其体积足以让首次 Android 构建保持实用，同时继续使用标准 llama.cpp 模型格式。

模型下载独立于当前可见页面运行，因此页面导航不会取消下载，persistent banner 会报告进度。下载完成后，应用会验证 HTTP status 与最小文件大小，再把 partial file 原子提升为正式模型。首次启动、Models 和 Settings 都把本地模型保留为明确的用户选择。

应用不会嵌入 Node/Cordis runtime，也不会宣称支持 Harness tools、workspaces、plugins 与 session protocols。这些能力需要单独设计 mobile-compatible service protocol；Android client 只展示它能在设备端运行的行为。

## Alternatives considered

- **在 Android 中打包 Electron 或 Node** — Electron 没有 Android runtime；嵌入无关的 Node distribution 会保留 desktop process assumptions，却无法形成受支持的 Android application lifecycle。
- **在 WebView 中渲染 desktop Web UI** — WebView 仍需要可访问的 Harness backend，本身也无法提供所需的离线模型路径。
- **把所有 Harness package 移植到 React Native** — 这些 package 依赖 Node process、filesystem 与 plugin semantics，无法直接映射到 React Native runtime；把它当作首次 port 会延迟可测试的 mobile 应用，并掩盖尚未支持的能力。

## Consequences

Android 获得可构建的 native client，包括首次启动模型设置、非阻塞进度、本地设置、持久化 conversation state，以及一次模型下载后的离线推理。应用与模型会增加大型 native dependency closure，并需要 Android NDK 构建。首个部分有意定位为 local chat client，而不是与 desktop Harness 功能对等；未来的 remote Harness integration 需要 authenticated protocol 与明确的 capability presentation。
