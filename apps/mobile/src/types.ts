/** A persisted chat message shown by the mobile client. */
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/** Screens available from the bottom navigation bar. */
export type ScreenName = 'chat' | 'models' | 'settings'

/** Lifecycle state of the bundled local-model option. */
export type ModelPhase =
  | 'checking'
  | 'missing'
  | 'downloading'
  | 'ready'
  | 'loading'
  | 'error'
