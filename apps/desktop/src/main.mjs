import { spawn } from 'node:child_process'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, session, shell, Tray } from 'electron'
import { createModelDownloader } from 'node-llama-cpp'
import { migrateLegacyAgentPreset } from './settings-migration.mjs'

const require = createRequire(import.meta.url)
const READY_LINE = /^dsh web: (https?:\/\/\S+)/mu
const STARTUP_TIMEOUT_MS = 60_000
const RECOMMENDED_MODEL_URI = 'hf:unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M'
const DESKTOP_STATE_FILE = 'desktop-state.json'
const IPC = {
  state: 'dsh-desktop:local-model-state',
  stateChanged: 'dsh-desktop:local-model-state-changed',
  download: 'dsh-desktop:download-local-model',
  choose: 'dsh-desktop:choose-local-model',
  disable: 'dsh-desktop:disable-local-model',
  dismissOnboarding: 'dsh-desktop:dismiss-local-model-onboarding',
}

let backend
let backendUrl
let desktopState = { localModelOnboardingComplete: false }
let localModelPath
let modelDownloadState = { status: 'idle' }
let modelDownloadStart
let modelDownloadTask
let lastDownloadProgressAt = 0
let mainWindow
let quitting = false
let restartingBackend = false
let restartTimer
let tray

app.enableSandbox()

/** Return whether a navigation target belongs to the local Harness server. */
function isAllowedUrl(value, allowedOrigin) {
  try {
    return new URL(value).origin === allowedOrigin
  } catch {
    return false
  }
}

/** Resolve the built CLI through the production dependency graph. */
function resolveCliEntry() {
  const manifest = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(manifest), 'lib', 'bin.js')
}

/** Describe a backend exit and retain enough stderr to diagnose it. */
function backendExitError(code, stderr) {
  const detail = stderr.trim()
  return new Error(`dsh web exited before startup (code ${String(code)})${detail === '' ? '' : `\n\n${detail}`}`)
}

/** Forward backend output to the app log and resolve its readiness URL. */
function waitForBackend(child, stderr) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      reject(new Error(`dsh web did not become ready within ${STARTUP_TIMEOUT_MS / 1000} seconds`))
    }, STARTUP_TIMEOUT_MS)

    const finish = (callback, value) => {
      clearTimeout(timer)
      child.off('exit', exited)
      callback(value)
    }
    const exited = (code) => {
      finish(reject, backendExitError(code, stderr()))
    }
    child.once('exit', exited)
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      output = `${output}${text}`.slice(-16_384)
      const match = READY_LINE.exec(output)
      if (match?.[1] !== undefined) finish(resolve, match[1])
    })
  })
}

/** Start the stock Web profile through packaged Electron's Node runtime. */
async function startBackend() {
  const patches = [join(import.meta.dirname, 'desktop.patch.yml')]
  if (localModelPath !== undefined) patches.push(join(import.meta.dirname, 'desktop-local-default.patch.yml'))
  const patchArguments = patches.flatMap((patch) => ['--patch', patch])
  const child = spawn(process.execPath, [
    '--expose-internals',
    resolveCliEntry(),
    'web', ...patchArguments,
    '--no-open', '--host', '127.0.0.1', '--port', '0',
  ], {
    cwd: app.getPath('home'),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_DESKTOP_LOCAL_MODEL_PATH: localModelPath ?? '',
      DSH_DESKTOP_WORKSPACE_PATH: app.getPath('home'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend = child
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    process.stderr.write(text)
    stderr = `${stderr}${text}`
    if (stderr.length > 8192) stderr = `${stderr.slice(0, 4096)}\n…\n${stderr.slice(-4096)}`
  })
  child.once('exit', (code) => {
    backend = undefined
    if (quitting || restartingBackend) return
    dialog.showErrorBox('DeepSeek Harness', backendExitError(code, stderr).message)
    app.quit()
  })
  return waitForBackend(child, () => stderr)
}

/** Read desktop-owned state and discard a selected model that no longer exists. */
async function loadDesktopState() {
  try {
    const raw = await readFile(join(app.getPath('userData'), DESKTOP_STATE_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    const state = { localModelOnboardingComplete: parsed.localModelOnboardingComplete === true }
    if (typeof parsed.modelPath !== 'string' || parsed.modelPath.length === 0) return state
    try {
      await access(parsed.modelPath)
      return { ...state, modelPath: parsed.modelPath }
    } catch (error) {
      if (error?.code === 'ENOENT') return state
      throw error
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { localModelOnboardingComplete: false }
    throw error
  }
}

/** Atomically retain desktop-owned onboarding and local-model state. */
async function saveDesktopState(next) {
  const directory = app.getPath('userData')
  await mkdir(directory, { recursive: true })
  const target = join(directory, DESKTOP_STATE_FILE)
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, target)
  desktopState = next
  localModelPath = next.modelPath
}

/** Return the renderer-safe local-model state. */
function localModelState() {
  return {
    configured: localModelPath !== undefined,
    onboardingComplete: desktopState.localModelOnboardingComplete,
    recommendedModel: 'Qwen3 4B Instruct Q4_K_M',
    download: modelDownloadState,
    ...localModelPath === undefined
      ? {}
      : { modelPath: localModelPath, modelName: basename(localModelPath) },
  }
}

/** Publish model state without exposing Electron event objects to the renderer. */
function publishLocalModelState() {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IPC.stateChanged, localModelState())
}

/** Restart only the Web-profile child and reconnect the existing window. */
async function restartBackend() {
  restartingBackend = true
  try {
    const child = backend
    if (child !== undefined) {
      await new Promise((resolve) => {
        child.once('exit', resolve)
        child.kill()
      })
    }
    backendUrl = await startBackend()
    await mainWindow?.loadURL(backendUrl)
  } finally {
    restartingBackend = false
  }
}

/** Restart after an IPC response reaches the renderer that requested the change. */
function scheduleBackendRestart() {
  if (restartTimer !== undefined) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartTimer = undefined
    void restartBackend().catch((error) => {
      dialog.showErrorBox('DeepSeek Harness', error instanceof Error ? error.message : String(error))
    })
  }, 250)
}

/** Persist a selected model and mark desktop local-model onboarding complete. */
async function selectLocalModel(modelPath, delayedRestart) {
  await saveDesktopState({ modelPath, localModelOnboardingComplete: true })
  if (delayedRestart) scheduleBackendRestart()
  else await restartBackend()
}

/** Download the maintained default GGUF with native progress reporting. */
async function downloadRecommendedModelFile() {
  const modelsDirectory = join(app.getPath('userData'), 'models')
  await mkdir(modelsDirectory, { recursive: true })
  mainWindow?.setProgressBar(0)
  try {
    const downloader = await createModelDownloader({
      modelUri: RECOMMENDED_MODEL_URI,
      dirPath: modelsDirectory,
      showCliProgress: false,
      onProgress: ({ totalSize, downloadedSize }) => {
        mainWindow?.setProgressBar(totalSize === 0 ? 0 : downloadedSize / totalSize)
        modelDownloadState = { status: 'downloading', downloadedBytes: downloadedSize, totalBytes: totalSize }
        const now = Date.now()
        if (now - lastDownloadProgressAt >= 100 || downloadedSize === totalSize) {
          lastDownloadProgressAt = now
          publishLocalModelState()
        }
      },
    })
    return await downloader.download()
  } finally {
    mainWindow?.setProgressBar(-1)
  }
}

/** Start one main-process download and keep it alive across renderer navigation. */
async function startRecommendedModelDownload() {
  if (modelDownloadTask !== undefined) return { state: localModelState(), task: modelDownloadTask }
  if (modelDownloadStart !== undefined) return modelDownloadStart
  const start = (async () => {
    await saveDesktopState({ ...desktopState, localModelOnboardingComplete: true })
    modelDownloadState = { status: 'downloading', downloadedBytes: 0, totalBytes: 0 }
    lastDownloadProgressAt = 0
    publishLocalModelState()
    const task = (async () => {
      try {
        await selectLocalModel(await downloadRecommendedModelFile(), true)
        modelDownloadState = { status: 'idle' }
        publishLocalModelState()
      } catch (error) {
        modelDownloadState = { status: 'failed' }
        publishLocalModelState()
        throw error
      } finally {
        modelDownloadTask = undefined
      }
    })()
    modelDownloadTask = task
    void task.catch(() => {})
    return { state: localModelState(), task }
  })()
  modelDownloadStart = start
  try {
    return await start
  } finally {
    modelDownloadStart = undefined
  }
}

/** Select an existing GGUF without copying it into application storage. */
async function chooseLocalModelFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a local GGUF model',
    buttonLabel: 'Use model',
    filters: [{ name: 'GGUF model', extensions: ['gguf'] }],
    properties: ['openFile'],
  })
  const [modelPath] = result.filePaths
  return result.canceled ? undefined : modelPath
}

/** Download through the native application menu and report terminal status. */
async function downloadRecommendedModelFromMenu() {
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Download', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Download local model',
    message: 'Download Qwen3 4B Instruct (Q4_K_M)?',
    detail: 'The download is approximately 2.5 GB and is stored in the application data directory.',
  })
  if (confirmation.response !== 0) return
  try {
    const { task } = await startRecommendedModelDownload()
    await task
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'DeepSeek Harness',
      message: 'Local model is ready',
      detail: 'The local GGUF model is selected for new sessions.',
    })
  } catch (error) {
    dialog.showErrorBox('Local model download failed', error instanceof Error ? error.message : String(error))
  }
}

/** Select an existing model through the native application menu. */
async function chooseLocalModelFromMenu() {
  try {
    const modelPath = await chooseLocalModelFile()
    if (modelPath === undefined) return
    await selectLocalModel(modelPath, false)
  } catch (error) {
    dialog.showErrorBox('Local model selection failed', error instanceof Error ? error.message : String(error))
  }
}

/** Require an IPC request to originate from the application window. */
function assertMainWindowSender(event) {
  if (mainWindow === undefined || event.sender !== mainWindow.webContents) {
    throw new Error('desktop local-model request came from an unknown renderer')
  }
}

/** Expose the narrow local-model bridge consumed by the desktop settings plugin. */
function installLocalModelIpc() {
  ipcMain.handle(IPC.state, (event) => {
    assertMainWindowSender(event)
    return localModelState()
  })
  ipcMain.handle(IPC.download, async (event) => {
    assertMainWindowSender(event)
    return (await startRecommendedModelDownload()).state
  })
  ipcMain.handle(IPC.choose, async (event) => {
    assertMainWindowSender(event)
    const modelPath = await chooseLocalModelFile()
    if (modelPath === undefined) return { canceled: true, state: localModelState() }
    await selectLocalModel(modelPath, true)
    return { canceled: false, state: localModelState() }
  })
  ipcMain.handle(IPC.disable, async (event) => {
    assertMainWindowSender(event)
    await saveDesktopState({ localModelOnboardingComplete: true })
    scheduleBackendRestart()
    return localModelState()
  })
  ipcMain.handle(IPC.dismissOnboarding, async (event) => {
    assertMainWindowSender(event)
    await saveDesktopState({ ...desktopState, localModelOnboardingComplete: true })
    return localModelState()
  })
}

/** Install native model actions without exposing Electron APIs to the renderer. */
function installMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Local Model',
      submenu: [
        { label: 'Download Recommended Model…', click: () => { void downloadRecommendedModelFromMenu() } },
        { label: 'Choose GGUF File…', click: () => { void chooseLocalModelFromMenu() } },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Reveal the existing window, restoring it from the dock or taskbar first. */
function showMainWindow() {
  if (mainWindow === undefined) {
    void createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Keep the desktop process reachable after its window is hidden. */
function installTray() {
  const asset = process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png'
  const icon = nativeImage.createFromPath(join(import.meta.dirname, '..', 'build', asset))
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show DeepSeek Harness', click: showMainWindow },
    { type: 'separator' },
    { label: 'Download Recommended Model…', click: () => { void downloadRecommendedModelFromMenu() } },
    { label: 'Choose GGUF File…', click: () => { void chooseLocalModelFromMenu() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } },
  ]))
  tray.on('click', showMainWindow)
}

/** Open the local Harness origin without exposing Node APIs to its renderer. */
async function createWindow() {
  if (backendUrl === undefined) backendUrl = await startBackend()
  const allowedOrigin = new URL(backendUrl).origin
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#111827',
    title: 'DeepSeek Harness',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarOverlay: { color: '#00000000', symbolColor: '#6b7280', height: 40 } }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, 'preload.cjs'),
      sandbox: true,
      webviewTag: false,
    },
  })
  mainWindow = window
  window.once('ready-to-show', () => { window.show() })
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url, allowedOrigin)) return { action: 'allow' }
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedUrl(url, allowedOrigin)) return
    event.preventDefault()
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
  })
  await window.loadURL(backendUrl)
}

const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })
  app.on('before-quit', () => {
    quitting = true
    if (restartTimer !== undefined) clearTimeout(restartTimer)
    backend?.kill()
  })
  app.on('activate', () => {
    showMainWindow()
  })
  app.whenReady().then(async () => {
    await migrateLegacyAgentPreset(process.env.DSH_HOME ?? join(app.getPath('home'), '.dsh'))
    desktopState = await loadDesktopState()
    localModelPath = desktopState.modelPath
    installLocalModelIpc()
    installMenu()
    installTray()
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })
    await createWindow()
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('DeepSeek Harness failed to start', message)
    app.quit()
  })
}
