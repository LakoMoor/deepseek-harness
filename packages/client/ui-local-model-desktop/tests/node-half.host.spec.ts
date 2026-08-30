import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, Config } from '../src/index.ts'
import { apply as applyInvariant, inject as invariantInject, name as invariantName } from '../src/invariant.ts'

describe('desktop host bootstrap', () => {
  it('requires a startup Workspace path', () => {
    expect(() => Config({} as never)).toThrow()
  })

  it('registers the configured directory before startup completes', async () => {
    const create = vi.fn(async () => ({ id: 'home' }))
    const ctx = { workspaceRegistry: { create } } as unknown as Context

    await apply(ctx, { workspacePath: '/Users/example' })

    expect(create).toHaveBeenCalledExactlyOnceWith('/Users/example')
  })

  it('reserves invariant ownership', async () => {
    expect(invariantName).toBe('client-ui-local-model-desktop-invariant')
    expect(invariantInject).toEqual(['invariants'])
    const dispose = vi.fn()
    const register = vi.fn((_packageName: string, _installer: () => void) => dispose)
    expect(await applyInvariant({ invariants: { register } } as never)).toBe(dispose)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-local-model-desktop', expect.any(Function))
    expect(register.mock.calls[0]?.[1]()).toBeUndefined()
  })
})
