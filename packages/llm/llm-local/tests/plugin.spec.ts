import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { apply, Config } from '../src/index.ts'
import { apply as applyInvariant } from '../src/invariant.ts'

const config = {
  modelPath: '/models/local.gguf',
  provider: 'local',
  model: 'local-gguf',
  displayName: 'Local llama.cpp',
  contextWindow: 2048,
  maxTokens: 32,
}

describe('llm-local plugin', () => {
  it('declares the runtime schema and registers one disposable route', async () => {
    expect(Config).toBeDefined()
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    try {
      apply(ctx, config)
      await expect(ctx.llm.listModels('local')).resolves.toEqual([
        expect.objectContaining({ provider: 'local', id: 'local-gguf' }),
      ])
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each([
    [{ ...config, provider: ' ' }, 'provider'],
    [{ ...config, model: ' ' }, 'model'],
    [{ ...config, displayName: ' ' }, 'displayName'],
    [{ ...config, maxTokens: 2048 }, 'maxTokens'],
  ] as const)('rejects invalid config %#', (candidate, message) => {
    const ctx = { llm: { registerAdapter: vi.fn() }, effect: vi.fn() }
    expect(() => { apply(ctx as never, candidate) }).toThrow(message)
  })

  it('registers package invariant ownership', async () => {
    const dispose = vi.fn()
    const register = vi.fn().mockReturnValue(dispose)
    await expect(applyInvariant({ invariants: { register } } as never)).resolves.toBe(dispose)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-llm-local', expect.any(Function))
    const installer = register.mock.calls[0]?.[1] as (() => void) | undefined
    expect(installer?.()).toBeUndefined()
  })
})
