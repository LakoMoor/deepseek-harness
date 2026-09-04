import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Locale } from './i18n'
import type { ChatMessage } from './types'

const KEYS = {
  messages: '@dsh-mobile/messages',
  onboarding: '@dsh-mobile/onboarding-complete',
  locale: '@dsh-mobile/locale',
} as const

/** Reads persisted messages and returns an empty conversation for invalid data. */
export async function loadMessages(): Promise<ChatMessage[]> {
  const value = await AsyncStorage.getItem(KEYS.messages)
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : []
  } catch {
    return []
  }
}

/** Persists the current local conversation. */
export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.messages, JSON.stringify(messages))
}

/** Reports whether the first-run choice has already been shown. */
export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboarding)) === 'yes'
}

/** Records that the user made a first-run model choice. */
export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboarding, 'yes')
}

/** Reads a previously selected UI locale. */
export async function loadLocale(): Promise<Locale | null> {
  const value = await AsyncStorage.getItem(KEYS.locale)
  return value === 'ru' || value === 'en' ? value : null
}

/** Persists the selected UI locale. */
export async function saveLocale(locale: Locale): Promise<void> {
  await AsyncStorage.setItem(KEYS.locale, locale)
}
