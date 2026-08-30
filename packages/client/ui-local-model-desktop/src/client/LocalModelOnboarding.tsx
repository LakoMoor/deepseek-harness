import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopLocalModelBridge } from './bridge.ts'
import type { en } from './locales.ts'
import { useLocalModel } from './useLocalModel.ts'
import css from './LocalModelSurface.module.css'

/** Registration-side dependencies for desktop onboarding. */
export interface LocalModelOnboardingInjected {
  bridge: DesktopLocalModelBridge
  t: (key: keyof typeof en) => string
}

/** Onboarding owner props plus desktop dependencies. */
export type LocalModelOnboardingProps =
  PropsRuntime<'settings.onboarding'> & InjectFace<LocalModelOnboardingInjected>

const ignoreImplicitDismiss = (): void => {}

/**
 * Offer local inference once on the first desktop launch.
 * @param props - onboarding coordinator callbacks and Electron bridge.
 * @returns a blocking setup dialog until state loads or the step completes.
 */
export function LocalModelOnboarding({ bridge, complete, t }: LocalModelOnboardingProps): ReactNode {
  const controller = useLocalModel(bridge)

  useEffect(() => {
    if (controller.state?.onboardingComplete === true || controller.state?.configured === true) complete()
  }, [complete, controller.state?.configured, controller.state?.onboardingComplete])

  useEffect(() => {
    const root = document.getElementById('root')
    if (root === null || controller.state === undefined) return
    const previous = root.inert
    root.inert = true
    return () => { root.inert = previous }
  }, [controller.state])

  if (controller.state === undefined || controller.state.onboardingComplete || controller.state.configured) return null

  const finish = async (operation: () => Promise<boolean>): Promise<void> => {
    if (await operation()) complete()
  }

  return (
    <Modal open headless title={t('onboardingTitle')} onClose={ignoreImplicitDismiss} className={css.dialog as string}>
      <div className={css.dialogContent}>
        <h2 className={css.dialogTitle}>{t('onboardingTitle')}</h2>
        <p className={css.dialogDescription}>{t('onboardingDescription')}</p>
        <p className={css.hint}>{t('recommended')}</p>
        {controller.failed && <p role="alert" className={css.error}>{t('failed')}</p>}
        <div className={css.actions}>
          <Button variant="primary" disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void finish(controller.download) }}>
            {controller.busy === 'download' ? t('downloading') : t('download')}
          </Button>
          <Button variant="outline" disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void finish(controller.choose) }}>
            {controller.busy === 'choose' ? t('choosing') : t('choose')}
          </Button>
          <Button disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void finish(controller.dismiss) }}>
            {t('onboardingLater')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
