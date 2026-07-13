import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import QRCode from 'qrcode'
import { KINDLE_EXTENSIONS, sendToKindle } from '../kindle.js'
import { ShareServer } from '../share-server.js'
import type { SmtpConfig } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devRoot = process.env.VITE_DEV_SERVER_URL ? path.join(process.cwd(), '.dev-data') : undefined

if (devRoot) {
  // Keep settings stable, but give Chromium a fresh disposable profile on each
  // development run. This avoids Windows DPAPI errors from stale encrypted cache.
  app.setPath('userData', path.join(devRoot, 'profiles', String(process.pid)))
  app.setPath('sessionData', path.join(devRoot, 'sessions', String(process.pid)))
}

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('in-process-gpu')
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('use-gl', 'angle')
}

const store = new Store<{ smtp?: SmtpConfig }>({ name: 'settings', ...(devRoot ? { cwd: path.join(devRoot, 'config') } : {}) })
const share = new ShareServer()

// Some Windows graphics drivers and restricted environments can make Chromium's
// GPU process fail before the renderer paints anything, resulting in a white window.
app.disableHardwareAcceleration()

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 850,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    backgroundColor: '#f5f6fa',
    webPreferences: { preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL()
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(currentUrl).origin) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  win.webContents.once('did-finish-load', async () => {
    const bridgeReady = await win.webContents.executeJavaScript("typeof window.pageBridge !== 'undefined'")
    if (!bridgeReady) console.error('Page Bridge preload failed to initialize')
  })
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})
app.on('window-all-closed', () => { share.stop(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() })

ipcMain.handle('config:get', () => store.get('smtp') ?? null)
ipcMain.handle('config:save', (_e, config: SmtpConfig) => { store.set('smtp', config); return true })
ipcMain.handle('files:pick', async (_e, kindle: boolean) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: kindle ? [{ name: 'Kindle 支持的文件', extensions: KINDLE_EXTENSIONS.map(x => x.slice(1)) }] : undefined })
  return result.canceled ? [] : result.filePaths
})
ipcMain.handle('kindle:send', async (_e, files: string[], recipients: string[]) => {
  const config = store.get('smtp'); if (!config) throw new Error('请先完成 SMTP 配置')
  await sendToKindle(config, files, recipients); return true
})
ipcMain.handle('share:start', async (_e, files: string[]) => {
  const info = await share.start(files)
  return { ...info, qrDataUrl: await QRCode.toDataURL(info.url, { width: 260, margin: 1 }) }
})
ipcMain.handle('share:stop', () => share.stop())
