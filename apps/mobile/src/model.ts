import RNFS from 'react-native-fs'

/** Official small model offered by the Android onboarding flow. */
export const RECOMMENDED_MODEL = {
  id: 'qwen3-0.6b-q8',
  fileName: 'Qwen3-0.6B-Q8_0.gguf',
  url: 'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf',
  minimumBytes: 600_000_000,
} as const

/** Absolute application-private directory containing downloaded GGUF files. */
export const MODEL_DIRECTORY = `${RNFS.DocumentDirectoryPath}/models`

/** Absolute path passed to llama.rn after a successful download. */
export const MODEL_PATH = `${MODEL_DIRECTORY}/${RECOMMENDED_MODEL.fileName}`

/** Partial file used until the model download completes successfully. */
export const PARTIAL_MODEL_PATH = `${MODEL_PATH}.part`

/** Converts byte progress into a clamped fraction suitable for a progress bar. */
export function progressFraction(written: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, written / total))
}

/** Returns whether a complete local model file is available. */
export async function hasDownloadedModel(): Promise<boolean> {
  if (!(await RNFS.exists(MODEL_PATH))) return false
  const stat = await RNFS.stat(MODEL_PATH)
  return Number(stat.size) >= RECOMMENDED_MODEL.minimumBytes
}
