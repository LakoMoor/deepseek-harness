import type { ReactNode } from 'react'
import { FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopLocalModelBridge } from './bridge.ts'
import type { en } from './locales.ts'
import { useLocalModel } from './useLocalModel.ts'
import css from './DesktopTitleBar.module.css'

/** Registration-side dependencies for the desktop title bar. */
export interface DesktopTitleBarInjected {
  bridge: DesktopLocalModelBridge
  t: (key: keyof typeof en, values?: Record<string, string>) => string
}

/** Shell-overlay owner props plus desktop dependencies. */
export type DesktopTitleBarProps =
  PropsRuntime<'shell.overlay'> & InjectFace<DesktopTitleBarInjected>

/**
 * Render draggable desktop chrome and persistent model-download progress.
 * @param props - Electron bridge and localized copy.
 * @returns the desktop title bar.
 */
export function DesktopTitleBar({ bridge, t }: DesktopTitleBarProps): ReactNode {
  const controller = useLocalModel(bridge)
  const download = controller.state?.download
  const progress = download?.status === 'downloading' && download.totalBytes > 0
    ? Math.min(1, download.downloadedBytes / download.totalBytes)
    : undefined
  const percent = progress === undefined ? undefined : Math.round(progress * 100)

  return (
    <header
      className={`${css.titleBar} ${bridge.platform === 'darwin' ? css.mac : css.windowControls}`}
      data-desktop-title-bar
      data-platform={bridge.platform}
    >
      <div className={css.brand}>
        <FishLogo size={17} />
        <span>{t('titleBarTitle')}</span>
      </div>
      {download?.status === 'downloading' && (
        <div className={css.download} role="status">
          <span>{percent === undefined ? t('downloading') : t('downloadProgress', { percent: String(percent) })}</span>
          <progress
            className={css.progress}
            aria-label={t('downloadProgressLabel')}
            max={1}
            {...progress === undefined ? {} : { value: progress }}
          />
        </div>
      )}
    </header>
  )
}
