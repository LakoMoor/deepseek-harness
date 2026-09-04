import { progressFraction, RECOMMENDED_MODEL } from '../src/model'

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/data/user/0/ai.deepseek.harness.mobile/files',
  },
}))

describe('recommended local model', () => {
  it('uses the official Hugging Face repository', () => {
    expect(RECOMMENDED_MODEL.url).toContain(
      'huggingface.co/Qwen/Qwen3-0.6B-GGUF/',
    )
  })

  it('clamps progress to the progress bar range', () => {
    expect(progressFraction(25, 100)).toBe(0.25)
    expect(progressFraction(125, 100)).toBe(1)
    expect(progressFraction(-1, 100)).toBe(0)
    expect(progressFraction(1, 0)).toBe(0)
  })
})
