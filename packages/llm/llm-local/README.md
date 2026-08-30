---
description: "The same-host GGUF model adapter backed by node-llama-cpp."
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-local

English | [中文](README.zh.md)

## Summary

`dsh-llm-local` registers one text-only LLM provider whose model weights run on the same machine through `node-llama-cpp`. The plugin loads the configured GGUF lazily on the first request, retains the weights between requests, and allocates a fresh context for each request. A composition must supply the provider id, model id, display name, absolute `modelPath`, `contextWindow`, and `maxTokens`; omitting `modelPath` keeps the route mounted without advertising a selectable model.

The adapter translates complete Harness history into the GGUF chat template, including reasoning segments, tool declarations, tool calls, and correlated tool results. Each request reports llama.cpp input and output token counts. Image blocks fail with `UNSUPPORTED_CONTENT`, an absent model fails with `MODEL_NOT_CONFIGURED`, and malformed historical tool arguments fail with `INVALID_HISTORY`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin after `@deepseek-ai/dsh-llm`, then provide one absolute GGUF path and the route metadata advertised to model selectors. Desktop owns download and selection; other compositions may point `modelPath` at a file they manage. The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-llm-local) lists every accepted field.

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
## Understand the implementation

`NodeLlamaRuntime` owns one lazy `LlamaModel`, while `LocalLlamaAdapter` maps provider-neutral requests and stream chunks. Each request creates and disposes its own llama.cpp context; disposing the Cordis plugin releases the retained model and native runtime.

-----

<a id="further-exploration"></a>
## Further Exploration

- [LLM service](../llm/README.md) — the provider-neutral registry and streaming protocol.
- [Desktop application](../../../apps/desktop/README.md) — model download, selection, and platform packaging.
- [node-llama-cpp Electron guide](https://node-llama-cpp.withcat.ai/guide/electron) — native binary packaging requirements.

-----

<a id="model-experience"></a>
## Model Experience

### Request context and condition

#### What the model sees

The selected GGUF receives the assembled system prompt, conversation history, and tool schemas through its embedded chat template. The package adds no prompt text of its own.

#### Token effect

The request consumes the tokens produced by the model's chat template for the complete assembled context; generated tokens are bounded by the request override or configured `maxTokens`.

#### KV Cache effect

Each Harness request uses a fresh llama.cpp context, so KV cache state is independent across requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **One configured model per plugin instance** — switching GGUF files requires replacing the plugin configuration; disposing the plugin releases the loaded weights.
- **Text input only** — multimodal GGUF projections are not implemented; image-bearing requests fail before generation.

-----

<a id="dev-note"></a>
### Dev Note

`src/runtime.ts` owns llama.cpp lifecycle and history translation, `src/adapter.ts` owns Harness stream conversion, and `src/index.ts` owns configuration and Cordis registration. Run `pnpm exec vitest run packages/llm/llm-local/tests --coverage --coverage.include='packages/llm/llm-local/src/**/*.ts'` after changing this package.
