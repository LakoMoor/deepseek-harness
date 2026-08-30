import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopLocalModelBridge } from './bridge.ts'
import type { en } from './locales.ts'
import { useLocalModel } from './useLocalModel.ts'
import css from './LocalModelSurface.module.css'

/** Registration-side dependencies for the Settings card. */
export interface LocalModelSettingsInjected {
  bridge: DesktopLocalModelBridge
  t: (key: keyof typeof en, values?: Record<string, string>) => string
}

/** Models-footer owner props plus desktop dependencies. */
export type LocalModelSettingsCardProps =
  PropsRuntime<'settings.models.footer'> & InjectFace<LocalModelSettingsInjected>

/**
 * Render desktop model selection and download controls in Models settings.
 * @param props - Electron bridge and localized copy.
 * @returns the local-model settings card.
 */
export function LocalModelSettingsCard({ bridge, t }: LocalModelSettingsCardProps): ReactNode {
  const controller = useLocalModel(bridge)
  const [notice, setNotice] = useState<'ready' | 'disabled'>()
  const act = async (operation: () => Promise<boolean>, nextNotice: 'ready' | 'disabled'): Promise<void> => {
    if (await operation()) setNotice(nextNotice)
  }
  const download = controller.state?.download
  const progress = download?.status === 'downloading' && download.totalBytes > 0
    ? Math.min(1, download.downloadedBytes / download.totalBytes)
    : undefined

  return (
    <section className={css.card} aria-labelledby="desktop-local-model-title">
      <h3 id="desktop-local-model-title" className={css.title}>{t('title')}</h3>
      <p className={css.description}>{t('description')}</p>
      <p className={css.hint}>{t('recommended')}</p>
      {controller.state?.configured === true ? (
        <div className={css.status}>
          <p>{t('active', { model: controller.state.modelName ?? controller.state.recommendedModel })}</p>
          {controller.state.modelPath !== undefined && <p title={controller.state.modelPath}>{t('activePath', { path: controller.state.modelPath })}</p>}
        </div>
      ) : <p className={css.status}>{t('notConfigured')}</p>}
      {controller.failed && <p role="alert" className={css.error}>{t('failed')}</p>}
      {download?.status === 'downloading' && (
        <div className={css.downloadStatus} role="status">
          <span>{progress === undefined ? t('downloading') : t('downloadProgress', { percent: String(Math.round(progress * 100)) })}</span>
          <progress aria-label={t('downloadProgressLabel')} max={1} {...progress === undefined ? {} : { value: progress }} />
        </div>
      )}
      {notice !== undefined && <p role="status" className={css.success}>{t(notice)}</p>}
      <div className={css.actions}>
        <Button variant="primary" disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void controller.download() }}>
          {controller.busy === 'download' || controller.downloading ? t('downloading') : t('download')}
        </Button>
        <Button variant="outline" disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void act(controller.choose, 'ready') }}>
          {controller.busy === 'choose' ? t('choosing') : t('choose')}
        </Button>
        {controller.state?.configured === true && (
          <Button disabled={controller.busy !== undefined || controller.downloading} onClick={() => { void act(controller.disable, 'disabled') }}>
            {controller.busy === 'disable' ? t('disabling') : t('disable')}
          </Button>
        )}
      </div>
    </section>
  )
}
