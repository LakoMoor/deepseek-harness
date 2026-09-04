import { useCallback, useEffect, useRef, useState } from 'react'
import RNFS from 'react-native-fs'
import { initLlama, type LlamaContext } from 'llama.rn'

import type { Locale } from './i18n'
import { translate } from './i18n'
import {
  hasDownloadedModel,
  MODEL_DIRECTORY,
  MODEL_PATH,
  PARTIAL_MODEL_PATH,
  progressFraction,
  RECOMMENDED_MODEL,
} from './model'
import type { ChatMessage, ModelPhase } from './types'

/** Public state and actions for downloading and running the local GGUF model. */
export type LocalModelController = {
  phase: ModelPhase
  progress: number
  error: string | null
  download: () => Promise<void>
  cancelDownload: () => Promise<void>
  remove: () => Promise<void>
  generate: (
    messages: ChatMessage[],
    locale: Locale,
    onToken: (text: string) => void,
  ) => Promise<string>
  stop: () => Promise<void>
}

/** Owns model files, download progress, llama.cpp context, and generation. */
export function useLocalModel(): LocalModelController {
  const [phase, setPhase] = useState<ModelPhase>('checking')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const contextRef = useRef<LlamaContext | null>(null)
  const downloadJobRef = useRef<number | null>(null)
  const downloadAttemptRef = useRef(0)

  useEffect(() => {
    hasDownloadedModel()
      .then(found => setPhase(found ? 'ready' : 'missing'))
      .catch((reason) => {
        setError(String(reason))
        setPhase('error')
      })
  }, [])

  const download = useCallback(async () => {
    setError(null)
    setProgress(0)
    setPhase('downloading')
    const attempt = ++downloadAttemptRef.current
    try {
      await RNFS.mkdir(MODEL_DIRECTORY)
      if (await RNFS.exists(PARTIAL_MODEL_PATH)) {
        await RNFS.unlink(PARTIAL_MODEL_PATH)
      }
      const task = RNFS.downloadFile({
        fromUrl: RECOMMENDED_MODEL.url,
        toFile: PARTIAL_MODEL_PATH,
        progressDivider: 1,
        begin: (response) => {
          if (response.contentLength > 0) setProgress(0)
        },
        progress: (response) => {
          setProgress(
            progressFraction(response.bytesWritten, response.contentLength),
          )
        },
      })
      downloadJobRef.current = task.jobId
      const response = await task.promise
      downloadJobRef.current = null
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode}`)
      }
      const stat = await RNFS.stat(PARTIAL_MODEL_PATH)
      if (Number(stat.size) < RECOMMENDED_MODEL.minimumBytes) {
        throw new Error('Downloaded model is incomplete')
      }
      if (await RNFS.exists(MODEL_PATH)) await RNFS.unlink(MODEL_PATH)
      await RNFS.moveFile(PARTIAL_MODEL_PATH, MODEL_PATH)
      setProgress(1)
      setPhase('ready')
    } catch (reason) {
      downloadJobRef.current = null
      if (attempt !== downloadAttemptRef.current) return
      setError(String(reason))
      setPhase('error')
    }
  }, [])

  const cancelDownload = useCallback(async () => {
    downloadAttemptRef.current += 1
    const jobId = downloadJobRef.current
    if (jobId !== null) RNFS.stopDownload(jobId)
    downloadJobRef.current = null
    if (await RNFS.exists(PARTIAL_MODEL_PATH)) {
      await RNFS.unlink(PARTIAL_MODEL_PATH)
    }
    setProgress(0)
    setError(null)
    setPhase('missing')
  }, [])

  const remove = useCallback(async () => {
    if (contextRef.current) {
      await contextRef.current.release()
      contextRef.current = null
    }
    if (await RNFS.exists(MODEL_PATH)) await RNFS.unlink(MODEL_PATH)
    if (await RNFS.exists(PARTIAL_MODEL_PATH)) {
      await RNFS.unlink(PARTIAL_MODEL_PATH)
    }
    setProgress(0)
    setError(null)
    setPhase('missing')
  }, [])

  const ensureContext = useCallback(async (): Promise<LlamaContext> => {
    if (contextRef.current) return contextRef.current
    setPhase('loading')
    try {
      const context = await initLlama({
        model: `file://${MODEL_PATH}`,
        n_ctx: 4096,
        n_batch: 512,
        n_threads: 4,
        use_mmap: true,
        use_mlock: false,
      })
      contextRef.current = context
      setPhase('ready')
      return context
    } catch (reason) {
      setError(String(reason))
      setPhase('error')
      throw reason
    }
  }, [])

  const generate = useCallback(
    async (
      messages: ChatMessage[],
      locale: Locale,
      onToken: (text: string) => void,
    ): Promise<string> => {
      const context = await ensureContext()
      let streamed = ''
      const result = await context.completion(
        {
          messages: [
            { role: 'system', content: translate(locale, 'systemPrompt') },
            ...messages.map(message => ({
              role: message.role,
              content: message.text,
            })),
          ],
          enable_thinking: false,
          n_predict: 512,
          temperature: 0.7,
          top_p: 0.9,
          stop: ['<|im_end|>', '<|endoftext|>'],
        },
        (data) => {
          const token = data.content ?? data.token
          streamed += token
          onToken(streamed)
        },
      )
      return result.content || result.text || streamed
    },
    [ensureContext],
  )

  const stop = useCallback(async () => {
    await contextRef.current?.stopCompletion()
  }, [])

  return {
    phase,
    progress,
    error,
    download,
    cancelDownload,
    remove,
    generate,
    stop,
  }
}
