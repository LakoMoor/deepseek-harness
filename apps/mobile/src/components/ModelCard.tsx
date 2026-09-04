import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Locale } from '../i18n'
import { translate } from '../i18n'
import { colors, commonStyles } from '../theme'
import type { ModelPhase } from '../types'

type Props = {
  locale: Locale
  phase: ModelPhase
  progress: number
  error: string | null
  busy?: boolean
  onDownload: () => void
  onCancel: () => void
  onRemove: () => void
}

/** Displays the recommended model and its download controls. */
export function ModelCard({
  locale,
  phase,
  progress,
  error,
  busy = false,
  onDownload,
  onCancel,
  onRemove,
}: Props): React.JSX.Element {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)
  const percent = Math.round(progress * 100)
  const status =
    phase === 'ready'
      ? t('downloadReady')
      : phase === 'downloading'
        ? `${t('downloading')} · ${percent}%`
        : phase === 'loading'
          ? t('loading')
          : phase === 'checking'
            ? t('checking')
            : phase === 'error'
              ? t('downloadFailed')
              : t('modelMissing')

  return (
    <View style={[commonStyles.card, styles.card]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('recommended')}</Text>
      </View>
      <Text style={styles.name}>{t('localModel')}</Text>
      <Text style={commonStyles.body}>{t('modelDetails')}</Text>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            phase === 'ready' && styles.dotReady,
            phase === 'error' && styles.dotError,
          ]}
        />
        <Text style={styles.status}>{status}</Text>
      </View>
      {phase === 'downloading' ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.hint}>{t('downloadContinues')}</Text>
          <Pressable style={commonStyles.secondaryButton} onPress={onCancel}>
            <Text style={commonStyles.secondaryButtonText}>{t('cancel')}</Text>
          </Pressable>
        </>
      ) : null}
      {phase === 'missing' || phase === 'error' ? (
        <Pressable style={commonStyles.button} onPress={onDownload}>
          <Text style={commonStyles.buttonText}>
            {phase === 'error' ? t('retry') : t('downloadModel')}
          </Text>
        </Pressable>
      ) : null}
      {phase === 'ready' ? (
        <Pressable
          style={[commonStyles.secondaryButton, busy && styles.disabled]}
          disabled={busy}
          onPress={onRemove}>
          <Text style={commonStyles.secondaryButtonText}>{t('remove')}</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.technicalError}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: '#b9c0ff', fontSize: 12, fontWeight: '700' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  dot: { backgroundColor: colors.muted, borderRadius: 4, height: 8, width: 8 },
  dotReady: { backgroundColor: colors.success },
  dotError: { backgroundColor: colors.danger },
  status: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  track: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 5,
    height: 9,
    overflow: 'hidden',
  },
  fill: { backgroundColor: colors.accent, borderRadius: 5, height: 9 },
  hint: { color: colors.muted, fontSize: 13 },
  technicalError: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.45 },
})
