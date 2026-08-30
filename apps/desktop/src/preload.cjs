const { contextBridge, ipcRenderer } = require('electron')

const IPC = {
  state: 'dsh-desktop:local-model-state',
  stateChanged: 'dsh-desktop:local-model-state-changed',
  download: 'dsh-desktop:download-local-model',
  choose: 'dsh-desktop:choose-local-model',
  disable: 'dsh-desktop:disable-local-model',
  dismissOnboarding: 'dsh-desktop:dismiss-local-model-onboarding',
}

contextBridge.exposeInMainWorld('dshDesktop', Object.freeze({
  platform: process.platform,
  localModelState: () => ipcRenderer.invoke(IPC.state),
  subscribeLocalModelState: (listener) => {
    const wrapped = (_event, state) => { listener(state) }
    ipcRenderer.on(IPC.stateChanged, wrapped)
    return () => { ipcRenderer.removeListener(IPC.stateChanged, wrapped) }
  },
  downloadRecommendedModel: () => ipcRenderer.invoke(IPC.download),
  chooseLocalModel: () => ipcRenderer.invoke(IPC.choose),
  disableLocalModel: () => ipcRenderer.invoke(IPC.disable),
  dismissLocalModelOnboarding: () => ipcRenderer.invoke(IPC.dismissOnboarding),
}))
