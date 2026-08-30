---
description: "由 node-llama-cpp 支持的同主机 GGUF 模型 adapter。"
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-local

[English](README.md) | 中文

## 概述

`dsh-llm-local` 注册一个纯文本 LLM provider，并通过 `node-llama-cpp` 在同一台机器上运行模型权重。Plugin 会在首次请求时延迟加载已配置的 GGUF，在请求之间保留权重，并为每个请求分配新的 context。Composition 必须提供 provider id、model id、display name、绝对 `modelPath`、`contextWindow` 和 `maxTokens`；省略 `modelPath` 时 route 仍会挂载，但不会发布可选模型。

Adapter 会把完整的 Harness history 转换到 GGUF chat template，包括 reasoning segment、tool declaration、tool call 及其关联的 tool result。每个请求都会报告 llama.cpp 的 input 与 output token 数。Image block 以 `UNSUPPORTED_CONTENT` 失败，未配置模型时以 `MODEL_NOT_CONFIGURED` 失败，历史 tool argument 格式错误时以 `INVALID_HISTORY` 失败。

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

在 `@deepseek-ai/dsh-llm` 之后挂载本 plugin，并提供一个绝对 GGUF 路径与发布给模型选择器的 route metadata。Desktop 负责下载和选择；其他 composition 可以让 `modelPath` 指向自行管理的文件。生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-llm-local)列出所有接受字段。

```yaml
- name: '@deepseek-ai/dsh-llm-local'
  config:
    modelPath: /absolute/path/model.gguf
    provider: local
    model: local-gguf
    displayName: Local llama.cpp
    contextWindow: 32768
    maxTokens: 4096
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

`NodeLlamaRuntime` 拥有一个延迟加载的 `LlamaModel`，`LocalLlamaAdapter` 则映射 provider-neutral request 与 stream chunk。每个请求创建并释放自己的 llama.cpp context；释放 Cordis plugin 时会释放保留的模型与原生 runtime。

-----

<a id="further-exploration"></a>
## 进一步探索

- [LLM 服务](../llm/README.zh.md)——provider-neutral registry 与 streaming protocol。
- [Desktop 应用](../../../apps/desktop/README.zh.md)——模型下载、选择与平台打包。
- [node-llama-cpp Electron 指南](https://node-llama-cpp.withcat.ai/guide/electron)——原生 binary 打包要求。

-----

<a id="model-experience"></a>
## 模型体验

### 请求上下文与条件

#### 模型看到什么

所选 GGUF 通过其内置 chat template 接收组装后的 system prompt、conversation history 和 tool schema。此 package 不添加自己的 prompt 文本。

#### Token 影响

请求消耗模型 chat template 为完整组装 context 生成的 token；生成 token 受请求 override 或已配置 `maxTokens` 限制。

#### KV Cache 影响

每个 Harness 请求使用新的 llama.cpp context，因此请求之间的 KV cache 状态彼此独立。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **每个 plugin instance 配置一个模型** — 切换 GGUF 文件需要替换 plugin configuration；释放 plugin 时会释放已加载的权重。
- **仅支持文本输入** — 尚未实现 multimodal GGUF projection；包含 image 的请求会在生成前失败。

-----

<a id="dev-note"></a>
### 开发备注

`src/runtime.ts` 负责 llama.cpp lifecycle 与 history translation，`src/adapter.ts` 负责 Harness stream conversion，`src/index.ts` 负责 configuration 与 Cordis registration。修改本 package 后运行 `pnpm exec vitest run packages/llm/llm-local/tests --coverage --coverage.include='packages/llm/llm-local/src/**/*.ts'`。
