import { getLocales } from 'react-native-localize'

/** Languages shipped by the mobile UI. */
export type Locale = 'en' | 'ru'

const copy = {
  en: {
    appName: 'DeepSeek Harness',
    chat: 'Chat',
    models: 'Models',
    settings: 'Settings',
    welcomeTitle: 'Run privately on this phone',
    welcomeBody:
      'Download the recommended Qwen3 model once, then chat without an API key or internet connection.',
    downloadModel: 'Download model',
    exploreFirst: 'Explore first',
    recommended: 'Recommended',
    localModel: 'Qwen3 0.6B · Q8',
    modelDetails: 'Official GGUF · about 640 MB · Apache 2.0',
    downloadReady: 'Ready on this device',
    modelMissing: 'Not downloaded',
    checking: 'Checking local files…',
    downloading: 'Downloading model',
    loading: 'Loading model…',
    cancel: 'Cancel',
    retry: 'Try again',
    remove: 'Remove from device',
    removed: 'Model removed',
    chatEmptyTitle: 'Your private local assistant',
    chatEmptyBody: 'Messages and inference stay on this device.',
    inputPlaceholder: 'Write a message…',
    send: 'Send',
    stop: 'Stop',
    modelNeeded: 'Download the local model to start chatting.',
    openModels: 'Open Models',
    newChat: 'New chat',
    clearChat: 'Clear conversation',
    language: 'Language',
    russian: 'Русский',
    english: 'English',
    localOnly: 'Local inference',
    localOnlyBody: 'llama.cpp runs directly inside the Android app.',
    modelStorage: 'Model storage',
    downloadContinues: 'You can keep using the app while this downloads.',
    downloadFailed: 'The download failed. Check the connection and retry.',
    generationFailed: 'The local model could not answer. Try loading it again.',
    systemPrompt:
      'You are a concise, helpful assistant running locally on an Android phone. Reply in the language used by the user.',
  },
  ru: {
    appName: 'DeepSeek Harness',
    chat: 'Чат',
    models: 'Модели',
    settings: 'Настройки',
    welcomeTitle: 'Работайте приватно на телефоне',
    welcomeBody:
      'Один раз скачайте рекомендуемую модель Qwen3, затем общайтесь без API-ключа и подключения к интернету.',
    downloadModel: 'Скачать модель',
    exploreFirst: 'Сначала осмотреться',
    recommended: 'Рекомендуемая',
    localModel: 'Qwen3 0.6B · Q8',
    modelDetails: 'Официальный GGUF · около 640 МБ · Apache 2.0',
    downloadReady: 'Готова на устройстве',
    modelMissing: 'Не скачана',
    checking: 'Проверяем локальные файлы…',
    downloading: 'Скачивается модель',
    loading: 'Загружается модель…',
    cancel: 'Отменить',
    retry: 'Повторить',
    remove: 'Удалить с устройства',
    removed: 'Модель удалена',
    chatEmptyTitle: 'Ваш приватный локальный помощник',
    chatEmptyBody: 'Сообщения и вычисления остаются на этом устройстве.',
    inputPlaceholder: 'Напишите сообщение…',
    send: 'Отправить',
    stop: 'Стоп',
    modelNeeded: 'Скачайте локальную модель, чтобы начать общение.',
    openModels: 'Открыть модели',
    newChat: 'Новый чат',
    clearChat: 'Очистить диалог',
    language: 'Язык',
    russian: 'Русский',
    english: 'English',
    localOnly: 'Локальный режим',
    localOnlyBody: 'llama.cpp работает прямо внутри Android-приложения.',
    modelStorage: 'Хранилище модели',
    downloadContinues: 'Можно продолжать пользоваться приложением во время загрузки.',
    downloadFailed: 'Не удалось скачать модель. Проверьте соединение и повторите.',
    generationFailed: 'Локальная модель не смогла ответить. Попробуйте загрузить её снова.',
    systemPrompt:
      'Ты лаконичный и полезный помощник, работающий локально на Android-телефоне. Отвечай на языке пользователя.',
  },
} as const

/** Keys accepted by the localized UI copy function. */
export type CopyKey = keyof (typeof copy)['en']

/** Returns the initial supported locale from the Android locale list. */
export function detectLocale(): Locale {
  return getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'en'
}

/** Resolves one localized UI string. */
export function translate(locale: Locale, key: CopyKey): string {
  return copy[locale][key]
}
