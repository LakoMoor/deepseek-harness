/** Harness stream adapter over the local llama.cpp runtime. */

import { randomUUID } from 'node:crypto'
import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type {
  FinishReason,
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { Config } from './index.ts'
import { NodeLlamaRuntime, type LocalLlamaRuntime } from './runtime.ts'

function finishReason(kind: 'stop' | 'tool-calls' | 'max-tokens' | 'aborted'): FinishReason {
  if (kind === 'aborted') {
    return { kind, failure: { message: 'local GGUF generation was aborted', code: 'ABORTED' } }
  }
  return { kind }
}

/** One configured local model exposed through the provider-neutral LLM seam. */
export class LocalLlamaAdapter extends LlmAdapter {
  private readonly runtime: LocalLlamaRuntime

  public constructor(
    private readonly config: Config,
    runtime?: LocalLlamaRuntime,
  ) {
    super()
    this.runtime = runtime ?? new NodeLlamaRuntime(config)
  }

  public override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.config.displayName }
  }

  public override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    if (this.config.modelPath === undefined) return Promise.resolve([])
    return Promise.resolve([{
      provider,
      id: this.config.model,
      name: this.config.model,
      description: 'GGUF on this device',
      inputModalities: ['text'],
    }])
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      inputModalities: ['text'],
      context: { contextWindow: this.config.contextWindow },
      defaultMaxTokens: this.config.maxTokens,
    })
  }

  public override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const generated = await this.runtime.generate(options)
    let index = 0
    for (const part of generated.parts) {
      if (part.type === 'text' || part.type === 'reasoning') {
        yield { type: 'block-start', index, blockType: part.type }
        yield part.type === 'text'
          ? { type: 'text-delta', index, text: part.text }
          : { type: 'reasoning-delta', index, text: part.text }
        yield { type: 'block-end', index, block: { type: part.type, text: part.text } }
      } else {
        const id = ToolCallId(`local-${randomUUID()}`)
        yield { type: 'block-start', index, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index, id, name: part.name, argumentsDelta: part.arguments }
        yield { type: 'block-end', index, block: { type: 'tool-call', id, name: part.name, arguments: part.arguments } }
      }
      index += 1
    }
    yield {
      type: 'usage',
      usage: {
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        totalTokens: generated.inputTokens + generated.outputTokens,
      },
    }
    yield { type: 'finish', reason: finishReason(generated.stopReason) }
  }

  /** Release the loaded model and native llama.cpp runtime. */
  public dispose(): Promise<void> {
    return this.runtime.dispose()
  }
}
