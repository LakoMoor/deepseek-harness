import { StyleSheet } from 'react-native'

/** Shared dark theme used across mobile screens. */
export const colors = {
  background: '#0b0d12',
  surface: '#141820',
  surfaceRaised: '#1b2130',
  border: '#2b3344',
  text: '#f7f8fb',
  muted: '#99a3b5',
  accent: '#6e7cff',
  accentSoft: '#28305f',
  success: '#43d19e',
  danger: '#ff6b76',
} as const

/** Reusable layout primitives for the mobile interface. */
export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingVertical: 20, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
})
