/** Renderer-safe state owned by the Electron main process. */
export interface LocalModelState {
  configured: boolean
  onboardingComplete: boolean
  recommendedModel: string
  download: LocalModelDownloadState
  modelPath?: string
  modelName?: string
}

/** Background model-download state owned by the Electron main process. */
export type LocalModelDownloadState =
  | { status: 'idle' }
  | { status: 'downloading'; downloadedBytes: number; totalBytes: number }
  | { status: 'failed' }

/** Desktop window platform exposed without granting renderer process access. */
export type DesktopPlatform = 'darwin' | 'linux' | 'win32'

/** Result of the native file chooser. */
export interface ChooseLocalModelResult {
  canceled: boolean
  state: LocalModelState
}

/** Narrow preload API available only inside the desktop renderer. */
export interface DesktopLocalModelBridge {
  readonly platform: DesktopPlatform
  localModelState: () => Promise<LocalModelState>
  subscribeLocalModelState: (listener: (state: LocalModelState) => void) => () => void
  downloadRecommendedModel: () => Promise<LocalModelState>
  chooseLocalModel: () => Promise<ChooseLocalModelResult>
  disableLocalModel: () => Promise<LocalModelState>
  dismissLocalModelOnboarding: () => Promise<LocalModelState>
}

declare global {
  interface Window {
    readonly dshDesktop?: DesktopLocalModelBridge
  }
}
