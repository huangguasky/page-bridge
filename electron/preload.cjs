const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('pageBridge', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: config => ipcRenderer.invoke('config:save', config),
  pickFiles: (kindle = false) => ipcRenderer.invoke('files:pick', kindle),
  getPathForFile: file => webUtils.getPathForFile(file),
  sendKindle: (files, recipients) => ipcRenderer.invoke('kindle:send', files, recipients),
  startShare: files => ipcRenderer.invoke('share:start', files),
  stopShare: () => ipcRenderer.invoke('share:stop')
})
