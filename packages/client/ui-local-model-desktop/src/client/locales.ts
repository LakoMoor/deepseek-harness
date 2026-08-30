/** English strings for desktop local-model management. */
export const en = {
  title: 'Local model',
  description: 'Run conversations on this device with a GGUF model and llama.cpp.',
  recommended: 'Recommended: Qwen3 4B Instruct Q4_K_M · approximately 2.5 GB',
  notConfigured: 'No local model is selected. Cloud providers remain available.',
  active: 'Active model: {model}',
  activePath: 'Stored at {path}',
  download: 'Download recommended model',
  downloading: 'Downloading…',
  downloadProgress: 'Downloading local model · {percent}%',
  downloadProgressLabel: 'Local model download progress',
  choose: 'Choose GGUF file',
  choosing: 'Choosing…',
  disable: 'Disable local model',
  disabling: 'Disabling…',
  ready: 'The local model is ready. New sessions use it by default.',
  disabled: 'The local model is disabled. Cloud provider defaults are restored.',
  failed: 'The local-model action failed. Please try again.',
  onboardingTitle: 'Run DeepSeek Harness locally',
  onboardingDescription: 'Download the recommended model now so chats can work without an API key or internet connection after setup.',
  onboardingLater: 'Not now',
  titleBarTitle: 'DeepSeek Harness',
} as const

/** Desktop local-model dictionary key union. */
export type LocalModelKey = keyof typeof en

/** Chinese strings matching the English key set. */
export const zh: { [Key in LocalModelKey]: string } = {
  title: '本地模型',
  description: '使用 GGUF 模型和 llama.cpp 在此设备上运行对话。',
  recommended: '推荐：Qwen3 4B Instruct Q4_K_M · 约 2.5 GB',
  notConfigured: '尚未选择本地模型；云端模型提供方仍可使用。',
  active: '当前模型：{model}',
  activePath: '存储位置：{path}',
  download: '下载推荐模型',
  downloading: '下载中…',
  downloadProgress: '正在下载本地模型 · {percent}%',
  downloadProgressLabel: '本地模型下载进度',
  choose: '选择 GGUF 文件',
  choosing: '选择中…',
  disable: '停用本地模型',
  disabling: '停用中…',
  ready: '本地模型已就绪，新会话将默认使用它。',
  disabled: '本地模型已停用，已恢复云端模型提供方默认值。',
  failed: '本地模型操作失败，请重试。',
  onboardingTitle: '在本地运行 DeepSeek Harness',
  onboardingDescription: '立即下载推荐模型，完成设置后无需 API 密钥或网络连接也能进行对话。',
  onboardingLater: '暂不下载',
  titleBarTitle: 'DeepSeek Harness',
}
