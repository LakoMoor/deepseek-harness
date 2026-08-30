/**
 * Same-host GGUF model adapter backed by node-llama-cpp.
 *
 * The plugin only registers a route. Desktop owns model acquisition and passes
 * an absolute model path through its profile overlay, so ordinary Harness
 * distributions do not download models or carry the native runtime.
 *
 * @module @deepseek-ai/dsh-llm-local
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { LocalLlamaAdapter } from './adapter.ts'

export { LocalLlamaAdapter } from './adapter.ts'
export type { LocalGeneration, LocalGenerationPart, LocalLlamaRuntime } from './runtime.ts'

/** Configuration for one local GGUF route. */
export interface Config {
  /** Absolute GGUF path; omission leaves the route visible but unavailable. */
  modelPath?: string
  /** Provider route exposed to model selectors. */
  provider: string
  /** Model id exposed to model selectors. */
  model: string
  /** Human-readable provider name. */
  displayName: string
  /** Maximum context allocated for each request. */
  contextWindow: number
  /** Default response-token limit. */
  maxTokens: number
}

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({
  modelPath: z.string(),
  provider: z.string().required(),
  model: z.string().required(),
  displayName: z.string().required(),
  contextWindow: z.number().min(1024).step(1).required(),
  maxTokens: z.number().min(1).step(1).required(),
})

/** Cordis plugin name. */
export const name = 'llm-local'
/** Services required by the local adapter. */
export const inject = ['llm']

/** Register one local GGUF route for this composition. */
export function apply(ctx: Context, config: Config): void {
  if (config.provider.trim().length === 0) throw new Error('llm-local: provider must be non-empty')
  if (config.model.trim().length === 0) throw new Error('llm-local: model must be non-empty')
  if (config.displayName.trim().length === 0) throw new Error('llm-local: displayName must be non-empty')
  if (config.maxTokens >= config.contextWindow) {
    throw new Error('llm-local: maxTokens must be smaller than contextWindow')
  }
  const adapter = new LocalLlamaAdapter(config)
  ctx.llm.registerAdapter([config.provider], adapter)
  ctx.effect(function* () {
    yield async () => { await adapter.dispose() }
  }, 'llm-local native runtime')
}
