import React, { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { ScrollViewInstance } from 'react-native'
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context'

import { ModelCard } from './src/components/ModelCard'
import type { CopyKey, Locale } from './src/i18n'
import { detectLocale, translate } from './src/i18n'
import {
  completeOnboarding,
  isOnboardingComplete,
  loadLocale,
  loadMessages,
  saveLocale,
  saveMessages,
} from './src/persistence'
import { colors, commonStyles } from './src/theme'
import type { ChatMessage, ScreenName } from './src/types'
import { useLocalModel } from './src/useLocalModel'

/** Root React Native application for Android. */
export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenName>('chat')
  const [locale, setLocale] = useState<Locale>(detectLocale())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [onboardingVisible, setOnboardingVisible] = useState(false)
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const model = useLocalModel()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const t = (key: CopyKey) => translate(locale, key)

  useEffect(() => {
    Promise.all([loadMessages(), loadLocale(), isOnboardingComplete()]).then(
      ([storedMessages, storedLocale, onboardingComplete]) => {
        setMessages(storedMessages)
        if (storedLocale) setLocale(storedLocale)
        setOnboardingVisible(!onboardingComplete)
        setHydrated(true)
      },
    )
  }, [])

  useEffect(() => {
    if (hydrated) saveMessages(messages)
  }, [hydrated, messages])

  const chooseLocale = (next: Locale) => {
    setLocale(next)
    saveLocale(next)
  }

  const finishOnboarding = () => {
    setOnboardingVisible(false)
    completeOnboarding()
  }

  const downloadFromOnboarding = () => {
    finishOnboarding()
    setScreen('models')
    model.download()
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || generating || model.phase !== 'ready') return
    const stamp = Date.now()
    const userMessage: ChatMessage = {
      id: `user-${stamp}`,
      role: 'user',
      text,
    }
    const assistantId = `assistant-${stamp}`
    const nextMessages = [...messages, userMessage]
    setInput('')
    setGenerating(true)
    setMessages([...nextMessages, { id: assistantId, role: 'assistant', text: '' }])
    try {
      const answer = await model.generate(nextMessages, locale, (partial) => {
        setMessages(current =>
          current.map(message =>
            message.id === assistantId
              ? { ...message, text: partial }
              : message,
          ),
        )
      })
      setMessages(current =>
        current.map(message =>
          message.id === assistantId ? { ...message, text: answer } : message,
        ),
      )
    } catch {
      setMessages(current =>
        current.map(message =>
          message.id === assistantId
            ? { ...message, text: t('generationFailed') }
            : message,
        ),
      )
    } finally {
      setGenerating(false)
    }
  }

  const clearChat = () => setMessages([])

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={commonStyles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandGlyph}>D</Text>
          </View>
          <Text style={styles.brand}>{t('appName')}</Text>
          <Pressable style={styles.newChat} onPress={clearChat}>
            <Text style={styles.newChatText}>＋</Text>
          </Pressable>
        </View>

        {model.phase === 'downloading' ? (
          <Pressable style={styles.downloadBanner} onPress={() => setScreen('models')}>
            <View style={styles.bannerTextRow}>
              <Text style={styles.bannerText}>{t('downloading')}</Text>
              <Text style={styles.bannerPercent}>
                {Math.round(model.progress * 100)}%
              </Text>
            </View>
            <View style={styles.bannerTrack}>
              <View
                style={[
                  styles.bannerFill,
                  { width: `${Math.round(model.progress * 100)}%` },
                ]}
              />
            </View>
          </Pressable>
        ) : null}

        <View style={styles.main}>
          {screen === 'chat' ? (
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.chatContent}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }>
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.heroMark}>
                      <Text style={styles.heroGlyph}>D</Text>
                    </View>
                    <Text style={commonStyles.title}>{t('chatEmptyTitle')}</Text>
                    <Text style={[commonStyles.body, styles.centerText]}>
                      {t('chatEmptyBody')}
                    </Text>
                  </View>
                ) : (
                  messages.map(message => (
                    <View
                      key={message.id}
                      style={[
                        styles.bubble,
                        message.role === 'user'
                          ? styles.userBubble
                          : styles.assistantBubble,
                      ]}>
                      <Text style={styles.messageText}>
                        {message.text || t('loading')}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>

              {model.phase !== 'ready' ? (
                <View style={styles.modelNeeded}>
                  <Text style={styles.modelNeededText}>{t('modelNeeded')}</Text>
                  <Pressable onPress={() => setScreen('models')}>
                    <Text style={styles.link}>{t('openModels')}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composer}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder={t('inputPlaceholder')}
                  placeholderTextColor={colors.muted}
                  editable={!generating && model.phase === 'ready'}
                  multiline
                  maxLength={4000}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    (!input.trim() || model.phase !== 'ready') && styles.disabled,
                  ]}
                  onPress={generating ? () => model.stop() : () => sendMessage()}>
                  <Text style={styles.sendGlyph}>{generating ? '■' : '↑'}</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          ) : null}

          {screen === 'models' ? (
            <ScrollView contentContainerStyle={commonStyles.content}>
              <Text style={commonStyles.title}>{t('models')}</Text>
              <Text style={commonStyles.body}>{t('localOnlyBody')}</Text>
              <ModelCard
                locale={locale}
                phase={model.phase}
                progress={model.progress}
                error={model.error}
                busy={generating}
                onDownload={() => model.download()}
                onCancel={() => model.cancelDownload()}
                onRemove={() => model.remove()}
              />
            </ScrollView>
          ) : null}

          {screen === 'settings' ? (
            <ScrollView contentContainerStyle={commonStyles.content}>
              <Text style={commonStyles.title}>{t('settings')}</Text>
              <View style={[commonStyles.card, styles.settingsCard]}>
                <Text style={styles.settingTitle}>{t('language')}</Text>
                <View style={styles.segmented}>
                  <LanguageButton
                    label={t('russian')}
                    active={locale === 'ru'}
                    onPress={() => chooseLocale('ru')}
                  />
                  <LanguageButton
                    label={t('english')}
                    active={locale === 'en'}
                    onPress={() => chooseLocale('en')}
                  />
                </View>
              </View>
              <View style={[commonStyles.card, styles.settingsCard]}>
                <Text style={styles.settingTitle}>{t('modelStorage')}</Text>
                <Text style={commonStyles.body}>{t('modelDetails')}</Text>
                {model.phase === 'ready' ? (
                  <Pressable
                    style={[
                      commonStyles.secondaryButton,
                      generating && styles.disabled,
                    ]}
                    disabled={generating}
                    onPress={() => model.remove()}>
                    <Text style={commonStyles.secondaryButtonText}>{t('remove')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[
                      commonStyles.button,
                      (model.phase === 'downloading' ||
                        model.phase === 'checking' ||
                        model.phase === 'loading') &&
                        styles.disabled,
                    ]}
                    disabled={
                      model.phase === 'downloading' ||
                      model.phase === 'checking' ||
                      model.phase === 'loading'
                    }
                    onPress={() => model.download()}>
                    <Text style={commonStyles.buttonText}>{t('downloadModel')}</Text>
                  </Pressable>
                )}
              </View>
              <Pressable style={commonStyles.secondaryButton} onPress={clearChat}>
                <Text style={commonStyles.secondaryButtonText}>{t('clearChat')}</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.tabs}>
          <Tab label={t('chat')} glyph="◉" active={screen === 'chat'} onPress={() => setScreen('chat')} />
          <Tab label={t('models')} glyph="⬡" active={screen === 'models'} onPress={() => setScreen('models')} />
          <Tab label={t('settings')} glyph="⚙" active={screen === 'settings'} onPress={() => setScreen('settings')} />
        </View>
      </SafeAreaView>

      <Modal visible={onboardingVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.heroMark}>
              <Text style={styles.heroGlyph}>D</Text>
            </View>
            <Text style={[commonStyles.title, styles.centerText]}>{t('welcomeTitle')}</Text>
            <Text style={[commonStyles.body, styles.centerText]}>{t('welcomeBody')}</Text>
            <View style={styles.modelSummary}>
              <Text style={styles.settingTitle}>{t('localModel')}</Text>
              <Text style={commonStyles.body}>{t('modelDetails')}</Text>
            </View>
            <Pressable style={commonStyles.button} onPress={downloadFromOnboarding}>
              <Text style={commonStyles.buttonText}>{t('downloadModel')}</Text>
            </Pressable>
            <Pressable style={commonStyles.secondaryButton} onPress={finishOnboarding}>
              <Text style={commonStyles.secondaryButtonText}>{t('exploreFirst')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  )
}

type TabProps = {
  label: string
  glyph: string
  active: boolean
  onPress: () => void
}

function Tab({ label, glyph, active, onPress }: TabProps): React.JSX.Element {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Text style={[styles.tabGlyph, active && styles.tabActive]}>{glyph}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  )
}

type LanguageButtonProps = {
  label: string
  active: boolean
  onPress: () => void
}

function LanguageButton({ label, active, onPress }: LanguageButtonProps): React.JSX.Element {
  return (
    <Pressable style={[styles.languageButton, active && styles.languageButtonActive]} onPress={onPress}>
      <Text style={[styles.languageText, active && styles.languageTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    height: 58,
    paddingHorizontal: 16,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  brandGlyph: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  brand: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '700' },
  newChat: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  newChatText: { color: colors.text, fontSize: 26, fontWeight: '300' },
  main: { flex: 1 },
  downloadBanner: {
    backgroundColor: colors.accentSoft,
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bannerTextRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bannerText: { color: '#d9ddff', fontSize: 13, fontWeight: '600' },
  bannerPercent: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  bannerTrack: { backgroundColor: '#3c467c', borderRadius: 3, height: 5, overflow: 'hidden' },
  bannerFill: { backgroundColor: '#aab2ff', height: 5 },
  chatContent: { flexGrow: 1, gap: 12, justifyContent: 'flex-end', padding: 16 },
  emptyState: { alignItems: 'center', gap: 12, paddingHorizontal: 30, paddingVertical: 60 },
  centerText: { textAlign: 'center' },
  heroMark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  heroGlyph: { color: '#ffffff', fontSize: 34, fontWeight: '900' },
  bubble: { borderRadius: 18, maxWidth: '88%', paddingHorizontal: 15, paddingVertical: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 23 },
  modelNeeded: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 14,
    padding: 12,
  },
  modelNeededText: { color: colors.muted, flex: 1, fontSize: 13 },
  link: { color: '#aab2ff', fontSize: 13, fontWeight: '700' },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    maxHeight: 130,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  disabled: { opacity: 0.45 },
  sendGlyph: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  settingsCard: { gap: 14 },
  settingTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  segmented: { backgroundColor: colors.background, borderRadius: 12, flexDirection: 'row', padding: 4 },
  languageButton: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 10 },
  languageButtonActive: { backgroundColor: colors.surfaceRaised },
  languageText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  languageTextActive: { color: colors.text },
  tabs: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: 6,
    paddingTop: 7,
  },
  tab: { alignItems: 'center', flex: 1, gap: 3, paddingVertical: 4 },
  tabGlyph: { color: colors.muted, fontSize: 18 },
  tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  tabActive: { color: '#aab2ff' },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 5, 9, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    maxWidth: 460,
    padding: 24,
    width: '100%',
  },
  modelSummary: { backgroundColor: colors.surfaceRaised, borderRadius: 14, gap: 6, padding: 14 },
})
