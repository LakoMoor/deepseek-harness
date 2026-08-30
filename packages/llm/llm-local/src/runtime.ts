/** node-llama-cpp request translation and model lifecycle. */

import type { ContentBlock, GenerateOptions, ToolSchema } from '@deepseek-ai/dsh-llm'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type {
  ChatHistoryItem,
  ChatModelFunctionCall,
  ChatModelFunctions,
  ChatModelSegment,
  GbnfJsonSchema,
  Llama,
  LLamaChatGenerateResponseOptions,
  LlamaModel,
} from 'node-llama-cpp'
import { getLlama, LlamaChat } from 'node-llama-cpp'
import type { Config } from './index.ts'

/** One generated response part in model order. */
export type LocalGenerationPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'reasoning'; readonly text: string }
  | { readonly type: 'tool-call'; readonly name: string; readonly arguments: string }

/** Completed local generation plus exact llama.cpp token accounting. */
export interface LocalGeneration {
  readonly parts: readonly LocalGenerationPart[]
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: 'stop' | 'tool-calls' | 'max-tokens' | 'aborted'
}

/** Runtime interface injected into the adapter for deterministic tests. */
export interface LocalLlamaRuntime {
  /** Generate one response from the complete provider-neutral request. */
  generate(options: GenerateOptions): Promise<LocalGeneration>
  /** Release native model resources. */
  dispose(): Promise<void>
}

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks.flatMap((block): string[] => {
    if (block.type === 'text' || block.type === 'reasoning') return [block.text]
    if (block.type === 'image') throw new LlmError('local GGUF models do not support image input', 'UNSUPPORTED_CONTENT')
    if (block.type === 'tool-result') return [textOf(block.content)]
    return []
  }).join('\n')
}

function parseArguments(value: string, name: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch (error: unknown) {
    throw new LlmError(`local GGUF history has invalid arguments for tool "${name}"`, 'INVALID_HISTORY', { cause: error })
  }
}

function toolResults(options: GenerateOptions): ReadonlyMap<string, unknown> {
  const results = new Map<string, unknown>()
  for (const message of options.messages) {
    for (const block of message.content) {
      if (block.type !== 'tool-result') continue
      results.set(block.toolCallId, block.isError
        ? { error: textOf(block.content) }
        : textOf(block.content))
    }
  }
  return results
}

/** Convert Harness history into node-llama-cpp's model-native chat history. */
export function toChatHistory(options: GenerateOptions): ChatHistoryItem[] {
  const history: ChatHistoryItem[] = []
  if (options.system !== undefined && options.system.length > 0) {
    history.push({ type: 'system', text: options.system })
  }
  const results = toolResults(options)
  for (const message of options.messages) {
    if (message.role === 'system') {
      const text = textOf(message.content)
      if (text.length > 0) history.push({ type: 'system', text })
      continue
    }
    if (message.content.every(block => block.type === 'tool-result')) continue
    if (message.role === 'user') {
      history.push({ type: 'user', text: textOf(message.content) })
      continue
    }
    const response: Array<string | ChatModelFunctionCall | ChatModelSegment> = []
    for (const block of message.content) {
      if (block.type === 'text') response.push(block.text)
      else if (block.type === 'reasoning') {
        response.push({ type: 'segment', segmentType: 'thought', text: block.text, ended: true })
      } else if (block.type === 'tool-call') {
        response.push({
          type: 'functionCall',
          name: block.name,
          params: parseArguments(block.arguments, block.name),
          result: results.get(block.id) ?? '',
        })
      } else if (block.type === 'image') {
        throw new LlmError('local GGUF models do not support image history', 'UNSUPPORTED_CONTENT')
      }
    }
    history.push({ type: 'model', response })
  }
  return history
}

function functionsOf(tools: readonly ToolSchema[] | undefined): ChatModelFunctions | undefined {
  if (tools === undefined || tools.length === 0) return undefined
  return Object.fromEntries(tools.map(tool => [tool.name, {
    description: tool.description,
    params: tool.parameters as GbnfJsonSchema,
  }]))
}

function stopReasonOf(value: string, hasCalls: boolean): LocalGeneration['stopReason'] {
  if (hasCalls || value === 'functionCalls') return 'tool-calls'
  if (value === 'maxTokens') return 'max-tokens'
  if (value === 'abort') return 'aborted'
  return 'stop'
}

/** Native runtime that keeps model weights loaded and allocates one context per request. */
export class NodeLlamaRuntime implements LocalLlamaRuntime {
  private llama: Llama | undefined
  private model: LlamaModel | undefined

  public constructor(private readonly config: Config) {}

  private async loadedModel(): Promise<LlamaModel> {
    if (this.model !== undefined) return this.model
    const modelPath = this.config.modelPath
    if (modelPath === undefined || modelPath.length === 0) {
      throw new LlmError('no local GGUF model is configured; download or select one from the desktop menu', 'MODEL_NOT_CONFIGURED')
    }
    this.llama = await getLlama()
    this.model = await this.llama.loadModel({ modelPath })
    return this.model
  }

  public async generate(options: GenerateOptions): Promise<LocalGeneration> {
    const model = await this.loadedModel()
    const context = await model.createContext({ contextSize: this.config.contextWindow })
    const sequence = context.getSequence()
    const before = sequence.tokenMeter.getState()
    try {
      const chat = new LlamaChat({ contextSequence: sequence, autoDisposeSequence: true })
      const functions = functionsOf(options.tools)
      const generationOptions: LLamaChatGenerateResponseOptions<ChatModelFunctions> = {
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        ...functions === undefined ? {} : { functions },
        ...options.temperature === undefined ? {} : { temperature: options.temperature },
        ...options.signal === undefined ? {} : { signal: options.signal },
        ...options.stop === undefined ? {} : { customStopTriggers: options.stop },
      }
      const response = await chat.generateResponse<ChatModelFunctions>(toChatHistory(options), generationOptions)
      const usage = sequence.tokenMeter.diff(before)
      const parts: LocalGenerationPart[] = response.fullResponse.map(part => typeof part === 'string'
        ? { type: 'text' as const, text: part }
        : { type: 'reasoning' as const, text: part.text })
      for (const call of response.functionCalls ?? []) {
        parts.push({ type: 'tool-call', name: call.functionName, arguments: JSON.stringify(call.params) })
      }
      return {
        parts,
        inputTokens: usage.usedInputTokens,
        outputTokens: usage.usedOutputTokens,
        stopReason: stopReasonOf(response.metadata.stopReason, (response.functionCalls?.length ?? 0) > 0),
      }
    } finally {
      await context.dispose()
    }
  }

  public async dispose(): Promise<void> {
    await this.model?.dispose()
    this.model = undefined
    await this.llama?.dispose()
    this.llama = undefined
  }
}
