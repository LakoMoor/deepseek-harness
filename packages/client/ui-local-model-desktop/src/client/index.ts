/** Desktop local-model onboarding and settings plugin, browser half. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { LocalModelOnboarding } from './LocalModelOnboarding.tsx'
import type { LocalModelOnboardingInjected } from './LocalModelOnboarding.tsx'
import { LocalModelSettingsCard } from './LocalModelSettingsCard.tsx'
import type { LocalModelSettingsInjected } from './LocalModelSettingsCard.tsx'
import { DesktopTitleBar } from './DesktopTitleBar.tsx'
import type { DesktopTitleBarInjected } from './DesktopTitleBar.tsx'
import { en, zh, type LocalModelKey } from './locales.ts'
import './bridge.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop local-model setup copy. */
    'desktop.localModel': LocalModelKey
  }
}

const NS = 'desktop.localModel'

/** Required client services. */
export const inject = ['slots', 'locale']

/**
 * Register desktop-only local-model onboarding and Models settings controls.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const bridge = window.dshDesktop
  if (bridge === undefined) return
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-local-model-desktop: dictionaries')
  const t = ctx.locale.bind(NS) as LocalModelSettingsInjected['t']
  const injected = (): LocalModelSettingsInjected => ({ bridge, t })
  const onboardingInjected = (): LocalModelOnboardingInjected => ({ bridge, t })
  const titleBarInjected = (): DesktopTitleBarInjected => ({ bridge, t })

  ctx.effect(() => {
    document.documentElement.classList.add('dsh-desktop-shell')
    return () => { document.documentElement.classList.remove('dsh-desktop-shell') }
  }, 'ui-local-model-desktop: desktop shell geometry')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'desktop-title-bar',
    order: -100,
    inject: titleBarInjected,
  }, DesktopTitleBar))

  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer',
    id: 'desktop-local-model',
    order: 100,
    inject: injected,
  }, LocalModelSettingsCard))
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
    name: 'settings.onboarding',
    id: 'desktop-local-model',
    order: -50,
    inject: onboardingInjected,
  }, LocalModelOnboarding))
}
