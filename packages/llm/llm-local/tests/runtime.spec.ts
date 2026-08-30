import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssistantMessage, createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { NodeLlamaRuntime, toChatHistory } from '../src/runtime.ts'

const llamaMocks = vi.hoisted(() => ({
  getLlama: vi.fn(),
  generateResponse: vi.fn(),
  constructChat: vi.fn(),
}))

vi.mock('node-llama-cpp', () => ({
  getLlama: llamaMocks.getLlama,
  LlamaChat: class {
    public constructor(options: unknown) {
      llamaMocks.constructChat(options)
    }

    public generateResponse(history: unknown, options: unknown): unknown {
      return llamaMocks.generateResponse(history, options)
    }
  },
}))

function request(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'local',
    model: 'local-gguf',
    messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] })],
    ...overrides,
  }
}

function nativeRuntime() {
  const disposeContext = vi.fn().mockResolvedValue(undefined)
  const sequence = {
    tokenMeter: {
      getState: vi.fn().mockReturnValue({ input: 1, output: 2 }),
      diff: vi.fn().mockReturnValue({ usedInputTokens: 3, usedOutputTokens: 4 }),
    },
  }
  const createContext = vi.fn().mockResolvedValue({
    getSequence: vi.fn().mockReturnValue(sequence),
    dispose: disposeContext,
  })
  const disposeModel = vi.fn().mockResolvedValue(undefined)
  const model = { createContext, dispose: disposeModel }
  const loadModel = vi.fn().mockResolvedValue(model)
  const disposeLlama = vi.fn().mockResolvedValue(undefined)
  llamaMocks.getLlama.mockResolvedValue({ loadModel, dispose: disposeLlama })
  return { createContext, disposeContext, disposeModel, loadModel, disposeLlama, sequence }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toChatHistory', () => {
  it('preserves system, reasoning, function calls, and correlated results', () => {
    const callId = ToolCallId('call-1')
    const options = {
      provider: 'local',
      model: 'local-gguf',
      system: 'system',
      messages: [
        createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'question' }] }),
        createAssistantMessage({
          source: { provider: 'local', model: 'local-gguf' },
          content: [
            { type: 'reasoning', text: 'plan' },
            { type: 'tool-call', id: callId, name: 'read', arguments: '{"path":"a"}' },
          ],
        }),
        createToolResultMessage({ callId, isError: false, content: [{ type: 'text', text: 'contents' }] }),
      ],
    }

    expect(toChatHistory(options)).toEqual([
      { type: 'system', text: 'system' },
      { type: 'user', text: 'question' },
      {
        type: 'model',
        response: [
          { type: 'segment', segmentType: 'thought', text: 'plan', ended: true },
          { type: 'functionCall', name: 'read', params: { path: 'a' }, result: 'contents' },
        ],
      },
    ])
  })

  it('rejects images and malformed historical call arguments', () => {
    const image = createUserMessage({
      source: { kind: 'user' },
      content: [{
        type: 'image',
        attachment: { attachmentId: 'x' as never, mediaType: 'image/png', width: 1, height: 1, bytes: 1 },
      }],
    })
    expect(() => toChatHistory({ provider: 'local', model: 'm', messages: [image] })).toThrow('do not support image')

    const malformed = createAssistantMessage({
      source: { provider: 'local', model: 'm' },
      content: [{ type: 'tool-call', id: ToolCallId('bad'), name: 'tool', arguments: '{' }],
    })
    expect(() => toChatHistory({ provider: 'local', model: 'm', messages: [malformed] })).toThrow('invalid arguments')
  })

  it('handles message-owned system text, errors, empty content, and missing results', () => {
    const callId = ToolCallId('missing')
    const errorId = ToolCallId('error')
    const messages = [
      { role: 'system', content: [{ type: 'text', text: 'policy' }] },
      { role: 'system', content: [] },
      {
        role: 'system',
        content: [
          { type: 'tool-result', content: [{ type: 'text', text: 'nested' }] },
          { type: 'future-block' },
        ],
      },
      createToolResultMessage({ callId: errorId, isError: true, content: [{ type: 'reasoning', text: 'failed' }] }),
      createAssistantMessage({
        source: { provider: 'local', model: 'm' },
        content: [
          { type: 'text', text: 'answer' },
          { type: 'tool-call', id: callId, name: 'missing', arguments: '{}' },
          { type: 'tool-call', id: errorId, name: 'failed', arguments: '{}' },
          { type: 'future-block' } as never,
        ],
      }),
    ]

    expect(toChatHistory(request({ system: '', messages }) as never)).toEqual([
      { type: 'system', text: 'policy' },
      { type: 'system', text: 'nested' },
      {
        type: 'model',
        response: [
          'answer',
          { type: 'functionCall', name: 'missing', params: {}, result: '' },
          { type: 'functionCall', name: 'failed', params: {}, result: { error: 'failed' } },
        ],
      },
    ])
  })

  it('rejects an image in assistant history', () => {
    const message = createAssistantMessage({
      source: { provider: 'local', model: 'm' },
      content: [{
        type: 'image',
        attachment: { attachmentId: 'x' as never, mediaType: 'image/png', width: 1, height: 1, bytes: 1 },
      } as never],
    })
    expect(() => toChatHistory(request({ messages: [message] }) as never)).toThrow('image history')
  })
})

describe('NodeLlamaRuntime', () => {
  const config = {
    modelPath: '/models/local.gguf',
    provider: 'local',
    model: 'local-gguf',
    displayName: 'Local llama.cpp',
    contextWindow: 2048,
    maxTokens: 32,
  }

  it.each([undefined, ''])('rejects an absent model path (%s)', async (modelPath) => {
    const runtime = new NodeLlamaRuntime(modelPath === undefined
      ? {
        provider: config.provider,
        model: config.model,
        displayName: config.displayName,
        contextWindow: config.contextWindow,
        maxTokens: config.maxTokens,
      }
      : { ...config, modelPath })
    await expect(runtime.generate(request())).rejects.toThrow('no local GGUF model')
    await runtime.dispose()
  })

  it('loads once, translates every generation option, and releases native resources', async () => {
    const native = nativeRuntime()
    llamaMocks.generateResponse.mockResolvedValue({
      fullResponse: ['answer', { type: 'segment', text: 'thought' }],
      functionCalls: [{ functionName: 'read', params: { path: 'a' } }],
      metadata: { stopReason: 'functionCalls' },
    })
    const runtime = new NodeLlamaRuntime(config)
    const signal = new AbortController().signal
    const options = request({
      maxTokens: 7,
      temperature: 0,
      signal,
      stop: ['END'],
      tools: [{ name: 'read', description: 'Read one file', parameters: { type: 'object' } }],
    })

    await expect(runtime.generate(options as never)).resolves.toEqual({
      parts: [
        { type: 'text', text: 'answer' },
        { type: 'reasoning', text: 'thought' },
        { type: 'tool-call', name: 'read', arguments: '{"path":"a"}' },
      ],
      inputTokens: 3,
      outputTokens: 4,
      stopReason: 'tool-calls',
    })
    await runtime.generate(options)

    expect(native.loadModel).toHaveBeenCalledOnce()
    expect(native.createContext).toHaveBeenCalledWith({ contextSize: 2048 })
    expect(llamaMocks.constructChat).toHaveBeenCalledWith({ contextSequence: native.sequence, autoDisposeSequence: true })
    expect(llamaMocks.generateResponse).toHaveBeenCalledWith(
      [{ type: 'user', text: 'hello' }],
      {
        maxTokens: 7,
        temperature: 0,
        signal,
        customStopTriggers: ['END'],
        functions: { read: { description: 'Read one file', params: { type: 'object' } } },
      },
    )
    expect(native.disposeContext).toHaveBeenCalledTimes(2)

    await runtime.dispose()
    expect(native.disposeModel).toHaveBeenCalledOnce()
    expect(native.disposeLlama).toHaveBeenCalledOnce()
  })

  it.each([
    ['maxTokens', 'max-tokens'],
    ['abort', 'aborted'],
    ['stop', 'stop'],
  ] as const)('maps native %s completion to %s', async (nativeReason, expected) => {
    const native = nativeRuntime()
    llamaMocks.generateResponse.mockResolvedValue({
      fullResponse: [],
      metadata: { stopReason: nativeReason },
    })
    const runtime = new NodeLlamaRuntime(config)

    await expect(runtime.generate(request({ tools: [] }) as never)).resolves.toMatchObject({ stopReason: expected })
    expect(llamaMocks.generateResponse).toHaveBeenCalledWith(
      [{ type: 'user', text: 'hello' }],
      { maxTokens: 32 },
    )
    expect(native.disposeContext).toHaveBeenCalledOnce()
    await runtime.dispose()
  })

  it('disposes the request context when native generation fails', async () => {
    const native = nativeRuntime()
    llamaMocks.generateResponse.mockRejectedValue(new Error('native failure'))
    const runtime = new NodeLlamaRuntime(config)

    await expect(runtime.generate(request())).rejects.toThrow('native failure')
    expect(native.disposeContext).toHaveBeenCalledOnce()
    await runtime.dispose()
  })
})
