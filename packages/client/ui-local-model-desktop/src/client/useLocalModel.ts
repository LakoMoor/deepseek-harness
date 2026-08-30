import { useCallback, useEffect, useState } from 'react'
import type { DesktopLocalModelBridge, LocalModelState } from './bridge.ts'

/** User-triggered local-model operation with component-local pending state. */
export type LocalModelAction = 'download' | 'choose' | 'disable' | 'dismiss'

/** Shared controller state for the onboarding and Settings surfaces. */
export interface LocalModelController {
  state: LocalModelState | undefined
  busy: LocalModelAction | undefined
  failed: boolean
  downloading: boolean
  download: () => Promise<boolean>
  choose: () => Promise<boolean>
  disable: () => Promise<boolean>
  dismiss: () => Promise<boolean>
}

/**
 * Bind one component to the Electron bridge and keep action state local.
 * @param bridge - preload API injected by the plugin registration.
 * @returns current model state and action callbacks.
 */
export function useLocalModel(bridge: DesktopLocalModelBridge): LocalModelController {
  const [state, setState] = useState<LocalModelState>()
  const [busy, setBusy] = useState<LocalModelAction>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = bridge.subscribeLocalModelState((next) => {
      if (active) setState(next)
    })
    void bridge.localModelState().then((next) => {
      if (active) setState(next)
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge])

  const run = useCallback(async (
    action: LocalModelAction,
    operation: () => Promise<LocalModelState>,
  ): Promise<boolean> => {
    setBusy(action)
    setFailed(false)
    try {
      setState(await operation())
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setBusy(undefined)
    }
  }, [])

  const download = useCallback(() => run('download', bridge.downloadRecommendedModel), [bridge, run])
  const disable = useCallback(() => run('disable', bridge.disableLocalModel), [bridge, run])
  const dismiss = useCallback(() => run('dismiss', bridge.dismissLocalModelOnboarding), [bridge, run])
  const choose = useCallback(async (): Promise<boolean> => {
    setBusy('choose')
    setFailed(false)
    try {
      const result = await bridge.chooseLocalModel()
      setState(result.state)
      return !result.canceled
    } catch {
      setFailed(true)
      return false
    } finally {
      setBusy(undefined)
    }
  }, [bridge])

  return {
    state,
    busy,
    failed: failed || state?.download.status === 'failed',
    downloading: state?.download.status === 'downloading',
    download,
    choose,
    disable,
    dismiss,
  }
}
