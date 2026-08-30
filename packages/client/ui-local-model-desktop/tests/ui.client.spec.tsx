// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/client/index.ts'
import { LocalModelOnboarding } from '../src/client/LocalModelOnboarding.tsx'
import type { LocalModelOnboardingProps } from '../src/client/LocalModelOnboarding.tsx'
import { LocalModelSettingsCard } from '../src/client/LocalModelSettingsCard.tsx'
import type { LocalModelSettingsCardProps } from '../src/client/LocalModelSettingsCard.tsx'
import { DesktopTitleBar } from '../src/client/DesktopTitleBar.tsx'
import type { DesktopTitleBarProps } from '../src/client/DesktopTitleBar.tsx'
import type { DesktopLocalModelBridge, LocalModelState } from '../src/client/bridge.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'dshDesktop')
  document.body.innerHTML = ''
  document.documentElement.classList.remove('dsh-desktop-shell')
})

const empty: LocalModelState = {
  configured: false,
  onboardingComplete: false,
  recommendedModel: 'Qwen3 4B Instruct Q4_K_M',
  download: { status: 'idle' },
}
const ready: LocalModelState = {
  configured: true,
  onboardingComplete: true,
  recommendedModel: 'Qwen3 4B Instruct Q4_K_M',
  download: { status: 'idle' },
  modelName: 'qwen.gguf',
  modelPath: '/models/qwen.gguf',
}
const t = (key: keyof typeof en, values?: Record<string, string>): string => {
  let value: string = en[key]
  for (const [name, replacement] of Object.entries(values ?? {})) value = value.replace(`{${name}}`, replacement)
  return value
}

function bridge(overrides: Partial<DesktopLocalModelBridge> = {}): DesktopLocalModelBridge {
  return {
    platform: 'darwin',
    localModelState: vi.fn().mockResolvedValue(empty),
    subscribeLocalModelState: vi.fn(() => () => {}),
    downloadRecommendedModel: vi.fn().mockResolvedValue(ready),
    chooseLocalModel: vi.fn().mockResolvedValue({ canceled: false, state: ready }),
    disableLocalModel: vi.fn().mockResolvedValue({ ...empty, onboardingComplete: true }),
    dismissLocalModelOnboarding: vi.fn().mockResolvedValue({ ...empty, onboardingComplete: true }),
    ...overrides,
  }
}

function onboardingProps(api: DesktopLocalModelBridge, complete: () => void): LocalModelOnboardingProps {
  return { bridge: api, complete, openSection: vi.fn(), stepId: 'desktop-local-model', t } as unknown as LocalModelOnboardingProps
}

function settingsProps(api: DesktopLocalModelBridge): LocalModelSettingsCardProps {
  return { bridge: api, t } as unknown as LocalModelSettingsCardProps
}

function titleBarProps(api: DesktopLocalModelBridge): DesktopTitleBarProps {
  return { bridge: api, t } as unknown as DesktopTitleBarProps
}

describe('desktop local-model client plugin', () => {
  it('declares its client services and stays absent in an ordinary browser', () => {
    expect(inject).toEqual(['slots', 'locale'])
    const effect = vi.fn()
    const injectSlot = vi.fn()
    apply({ effect, locale: {}, slots: { inject: injectSlot } } as unknown as ClientContext)
    expect(effect).not.toHaveBeenCalled()
    expect(injectSlot).not.toHaveBeenCalled()
  })

  it('registers the title bar, onboarding, and settings occupants inside Electron', () => {
    Object.defineProperty(window, 'dshDesktop', { configurable: true, value: bridge() })
    const registrations: unknown[] = []
    const register = vi.fn((options: unknown) => { registrations.push(options); return () => {} })
    const injectSlot = vi.fn((_name: string, callback: () => unknown) => callback())
    const registerLocale = vi.fn((_namespace: string, _dictionaries: { zh: typeof zh; en: typeof en }) => () => {})
    const ctx = {
      effect: vi.fn((callback: () => unknown) => callback()),
      locale: { register: registerLocale, bind: vi.fn(() => t) },
      slots: { inject: injectSlot, register },
    }
    apply(ctx as unknown as ClientContext)
    expect(registerLocale).toHaveBeenCalledWith('desktop.localModel', { zh, en })
    expect(document.documentElement.classList.contains('dsh-desktop-shell')).toBe(true)
    expect(registrations).toEqual([
      expect.objectContaining({ name: 'shell.overlay', id: 'desktop-title-bar', order: -100 }),
      expect.objectContaining({ name: 'settings.models.footer', id: 'desktop-local-model', order: 100 }),
      expect.objectContaining({ name: 'settings.onboarding', id: 'desktop-local-model', order: -50 }),
    ])
    for (const registration of registrations) {
      expect((registration as { inject: () => unknown }).inject()).toEqual(expect.objectContaining({ bridge: window.dshDesktop, t }))
    }
  })

  it('removes desktop shell geometry with its effect', () => {
    Object.defineProperty(window, 'dshDesktop', { configurable: true, value: bridge() })
    const disposers: Array<() => void> = []
    const ctx = {
      effect: vi.fn((callback: () => unknown) => {
        const result = callback()
        if (typeof result === 'function') disposers.push(result as () => void)
        return result
      }),
      locale: { register: vi.fn(() => () => {}), bind: vi.fn(() => t) },
      slots: { inject: vi.fn(), register: vi.fn() },
    }
    apply(ctx as unknown as ClientContext)
    expect(document.documentElement.classList.contains('dsh-desktop-shell')).toBe(true)
    for (const dispose of disposers) dispose()
    expect(document.documentElement.classList.contains('dsh-desktop-shell')).toBe(false)
  })

  it('downloads from onboarding and completes the step', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
    const api = bridge()
    const complete = vi.fn()
    render(<LocalModelOnboarding {...onboardingProps(api, complete)} />)
    expect(await screen.findByRole('heading', { name: en.onboardingTitle })).toBeTruthy()
    await waitFor(() => { expect(root.inert).toBe(true) })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: en.onboardingTitle })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.download }))
    await waitFor(() => { expect(api.downloadRecommendedModel).toHaveBeenCalledOnce() })
    await waitFor(() => { expect(complete).toHaveBeenCalled() })
  })

  it('allows postponing onboarding and reports a failed native action', async () => {
    const api = bridge({
      chooseLocalModel: vi.fn().mockRejectedValue(new Error('chooser unavailable')),
    })
    const complete = vi.fn()
    const view = render(<LocalModelOnboarding {...onboardingProps(api, complete)} />)
    await screen.findByRole('heading', { name: en.onboardingTitle })
    fireEvent.click(screen.getByRole('button', { name: en.choose }))
    expect((await screen.findByRole('alert')).textContent).toBe(en.failed)
    fireEvent.click(screen.getByRole('button', { name: en.onboardingLater }))
    await waitFor(() => { expect(api.dismissLocalModelOnboarding).toHaveBeenCalledOnce() })
    await waitFor(() => { expect(complete).toHaveBeenCalled() })
    view.unmount()
  })

  it('keeps onboarding open when the chooser is canceled', async () => {
    const api = bridge({ chooseLocalModel: vi.fn().mockResolvedValue({ canceled: true, state: empty }) })
    const complete = vi.fn()
    render(<LocalModelOnboarding {...onboardingProps(api, complete)} />)
    await screen.findByRole('heading', { name: en.onboardingTitle })
    fireEvent.click(screen.getByRole('button', { name: en.choose }))
    await waitFor(() => { expect(api.chooseLocalModel).toHaveBeenCalledOnce() })
    expect(complete).not.toHaveBeenCalled()
  })

  it('skips onboarding when desktop state is already complete', async () => {
    const complete = vi.fn()
    const api = bridge({ localModelState: vi.fn().mockResolvedValue({ ...empty, onboardingComplete: true }) })
    const view = render(<LocalModelOnboarding {...onboardingProps(api, complete)} />)
    await waitFor(() => { expect(complete).toHaveBeenCalled() })
    expect(view.container.innerHTML).toBe('')
  })

  it('manages a selected model from Settings', async () => {
    const api = bridge({ localModelState: vi.fn().mockResolvedValue(ready) })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect(await screen.findByText('Active model: qwen.gguf')).toBeTruthy()
    expect(screen.getByText('Stored at /models/qwen.gguf')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.disable }))
    expect((await screen.findByRole('status')).textContent).toBe(en.disabled)
    expect(api.disableLocalModel).toHaveBeenCalledOnce()
  })

  it('downloads and chooses models from Settings', async () => {
    const api = bridge()
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    await screen.findByText(en.notConfigured)
    fireEvent.click(screen.getByRole('button', { name: en.choose }))
    await waitFor(() => { expect(api.chooseLocalModel).toHaveBeenCalledOnce() })
    expect((await screen.findByRole('status')).textContent).toBe(en.ready)
    fireEvent.click(screen.getByRole('button', { name: en.download }))
    await waitFor(() => { expect(api.downloadRecommendedModel).toHaveBeenCalledOnce() })
  })

  it('shows background progress in Settings and disables conflicting actions', async () => {
    const downloading: LocalModelState = {
      ...empty,
      onboardingComplete: true,
      download: { status: 'downloading', downloadedBytes: 25, totalBytes: 100 },
    }
    const api = bridge({ localModelState: vi.fn().mockResolvedValue(downloading) })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect((await screen.findByRole('status')).textContent).toContain('25%')
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0.25')
    expect(screen.getByRole('button', { name: en.downloading })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.choose })).toHaveProperty('disabled', true)
  })

  it('shows indeterminate Settings progress until the download size is known', async () => {
    const api = bridge({
      localModelState: vi.fn().mockResolvedValue({
        ...empty,
        onboardingComplete: true,
        download: { status: 'downloading', downloadedBytes: 0, totalBytes: 0 },
      }),
    })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect((await screen.findByRole('status')).textContent).toBe(en.downloading)
    expect(screen.getByRole('progressbar').hasAttribute('value')).toBe(false)
  })

  it('renders determinate and indeterminate progress in the desktop title bar', async () => {
    const downloading: LocalModelState = {
      ...empty,
      onboardingComplete: true,
      download: { status: 'downloading', downloadedBytes: 175, totalBytes: 100 },
    }
    const api = bridge({ platform: 'win32', localModelState: vi.fn().mockResolvedValue(downloading) })
    const view = render(<DesktopTitleBar {...titleBarProps(api)} />)
    expect(await screen.findByText('Downloading local model · 100%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
    expect(view.container.querySelector('[data-desktop-title-bar]')?.getAttribute('data-platform')).toBe('win32')
    view.unmount()

    const unknown = bridge({
      localModelState: vi.fn().mockResolvedValue({
        ...downloading,
        download: { status: 'downloading', downloadedBytes: 0, totalBytes: 0 },
      }),
    })
    render(<DesktopTitleBar {...titleBarProps(unknown)} />)
    expect(await screen.findByText(en.downloading)).toBeTruthy()
    expect(screen.getByRole('progressbar').hasAttribute('value')).toBe(false)
  })

  it('receives main-process model state events and unsubscribes on unmount', async () => {
    let listener: ((state: LocalModelState) => void) | undefined
    const unsubscribe = vi.fn()
    const api = bridge({
      subscribeLocalModelState: vi.fn((next: (state: LocalModelState) => void) => { listener = next; return unsubscribe }),
    })
    const view = render(<LocalModelSettingsCard {...settingsProps(api)} />)
    await screen.findByText(en.notConfigured)
    listener?.(ready)
    expect(await screen.findByText('Active model: qwen.gguf')).toBeTruthy()
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
    listener?.(empty)
  })

  it('surfaces a failed background download reported by Electron', async () => {
    const api = bridge({
      localModelState: vi.fn().mockResolvedValue({ ...empty, download: { status: 'failed' } }),
    })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.failed)
  })

  it('does not announce a canceled Settings chooser', async () => {
    const api = bridge({ chooseLocalModel: vi.fn().mockResolvedValue({ canceled: true, state: empty }) })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    await screen.findByText(en.notConfigured)
    fireEvent.click(screen.getByRole('button', { name: en.choose }))
    await waitFor(() => { expect(api.chooseLocalModel).toHaveBeenCalledOnce() })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('reports a failed Settings download', async () => {
    const api = bridge({ downloadRecommendedModel: vi.fn().mockRejectedValue(new Error('download failed')) })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    await screen.findByText(en.notConfigured)
    fireEvent.click(screen.getByRole('button', { name: en.download }))
    expect((await screen.findByRole('alert')).textContent).toBe(en.failed)
  })

  it('falls back to the recommended name when a configured path has no display fields', async () => {
    const api = bridge({
      localModelState: vi.fn().mockResolvedValue({
        configured: true,
        onboardingComplete: true,
        recommendedModel: ready.recommendedModel,
        download: { status: 'idle' },
      }),
    })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect(await screen.findByText('Active model: Qwen3 4B Instruct Q4_K_M')).toBeTruthy()
    expect(screen.queryByText(/^Stored at /u)).toBeNull()
  })

  it('reports initial state failures in Settings', async () => {
    const api = bridge({ localModelState: vi.fn().mockRejectedValue(new Error('ipc failed')) })
    render(<LocalModelSettingsCard {...settingsProps(api)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.failed)
  })

  it('ignores a late initial-state result after unmount', async () => {
    let resolveState: ((state: LocalModelState) => void) | undefined
    const api = bridge({ localModelState: vi.fn(() => new Promise<LocalModelState>((resolve) => { resolveState = resolve })) })
    const view = render(<LocalModelSettingsCard {...settingsProps(api)} />)
    view.unmount()
    resolveState?.(empty)
    await Promise.resolve()
  })

  it('ignores a late initial-state failure after unmount', async () => {
    let rejectState: ((error: Error) => void) | undefined
    const api = bridge({
      localModelState: vi.fn(() => new Promise<LocalModelState>((_resolve, reject) => { rejectState = reject })),
    })
    const view = render(<LocalModelSettingsCard {...settingsProps(api)} />)
    view.unmount()
    rejectState?.(new Error('late failure'))
    await Promise.resolve()
  })
})
