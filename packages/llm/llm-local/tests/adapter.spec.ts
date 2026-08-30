import { describe, expect, it, vi } from 'vitest'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { LocalLlamaAdapter } from '../src/adapter.ts'
import type { LocalLlamaRuntime } from '../src/runtime.ts'
import type { Config } from '../src/index.ts'

const config: Config = {
  modelPath: '/models/local.gguf',
  provider: 'local',
  model: 'local-gguf',
  displayName: 'Local llama.cpp',
  contextWindow: 32768,
  maxTokens: 4096,
}

function request() {
  return {
    provider: 'local',
    model: 'local-gguf',
    messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text' as const, text: 'hello' }] })],
  }
}

describe('LocalLlamaAdapter', () => {
  it('advertises the configured route and exact model limits', async () => {
    const runtime = { generate: vi.fn(), dispose: vi.fn() } as unknown as LocalLlamaRuntime
    const adapter = new LocalLlamaAdapter(config, runtime)

    expect(adapter.providerInfo('local')).toEqual({ id: 'local', name: 'Local llama.cpp' })
    await expect(adapter.listModels('local')).resolves.toEqual([expect.objectContaining({
      provider: 'local', id: 'local-gguf', inputModalities: ['text'],
    })])
    await expect(adapter.resolveModel('local', 'local-gguf')).resolves.toEqual(expect.objectContaining({
      context: { contextWindow: 32768 }, defaultMaxTokens: 4096,
    }))
    await expect(new LocalLlamaAdapter({
      provider: config.provider,
      model: config.model,
      displayName: config.displayName,
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens,
    }, runtime).listModels('local')).resolves.toEqual([])
  })

  it('translates text, reasoning, calls, usage, and a terminal reason in order', async () => {
    const runtime: LocalLlamaRuntime = {
      generate: vi.fn().mockResolvedValue({
        parts: [
          { type: 'reasoning', text: 'plan' },
          { type: 'text', text: 'answer' },
          { type: 'tool-call', name: 'read', arguments: '{"path":"a"}' },
        ],
        inputTokens: 12,
        outputTokens: 7,
        stopReason: 'tool-calls',
      }),
      dispose: vi.fn(),
    }
    const chunks = []
    for await (const chunk of new LocalLlamaAdapter(config, runtime).stream(request())) chunks.push(chunk)

    expect(chunks.slice(0, 7)).toEqual([
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'plan' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'plan' } },
      { type: 'block-start', index: 1, blockType: 'text' },
      { type: 'text-delta', index: 1, text: 'answer' },
      { type: 'block-end', index: 1, block: { type: 'text', text: 'answer' } },
      { type: 'block-start', index: 2, blockType: 'tool-call' },
    ])
    expect(chunks[7]).toMatchObject({ type: 'tool-call-delta', index: 2, name: 'read', argumentsDelta: '{"path":"a"}' })
    expect(chunks[8]).toMatchObject({
      type: 'block-end', index: 2,
      block: { type: 'tool-call', name: 'read', arguments: '{"path":"a"}' },
    })
    expect(chunks.slice(9)).toEqual([
      { type: 'usage', usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ])
    const call = chunks.find(chunk => chunk.type === 'block-end' && chunk.block.type === 'tool-call')
    if (call?.type !== 'block-end' || call.block.type !== 'tool-call') throw new Error('missing call')
    expect(ToolCallId(call.block.id)).toBe(call.block.id)
  })

  it.each([
    ['stop', { kind: 'stop' }],
    ['max-tokens', { kind: 'max-tokens' }],
    ['aborted', { kind: 'aborted', failure: { message: 'local GGUF generation was aborted', code: 'ABORTED' } }],
  ] as const)('maps %s completion', async (stopReason, expected) => {
    const runtime: LocalLlamaRuntime = {
      generate: vi.fn().mockResolvedValue({ parts: [], inputTokens: 0, outputTokens: 0, stopReason }),
      dispose: vi.fn(),
    }
    const chunks = []
    for await (const chunk of new LocalLlamaAdapter(config, runtime).stream(request())) chunks.push(chunk)
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: expected })
  })

  it('releases the native runtime', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined)
    const runtime: LocalLlamaRuntime = {
      generate: vi.fn(),
      dispose,
    }
    const adapter = new LocalLlamaAdapter(config, runtime)

    await adapter.dispose()

    expect(dispose).toHaveBeenCalledOnce()
  })
})
