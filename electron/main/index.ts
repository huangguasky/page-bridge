import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
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

interface StoredSettings {
  smtp?: SmtpConfig
  smtpEncrypted?: string
}

const store = new Store<StoredSettings>({ name: 'settings', ...(devRoot ? { cwd: path.join(devRoot, 'config') } : {}) })
const share = new ShareServer()
const EBOOK_EXTENSIONS = ['.epub', '.mobi', '.azw3']

function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统的安全存储不可用，无法安全保存邮箱配置')
  }
}

function saveSmtpConfig(config: SmtpConfig) {
  requireEncryption()
  const encrypted = safeStorage.encryptString(JSON.stringify(config)).toString('base64')
  store.set('smtpEncrypted', encrypted)
  store.delete('smtp')
}

function getSmtpConfig(): SmtpConfig | null {
  const encrypted = store.get('smtpEncrypted')
  if (encrypted) {
    requireEncryption()
    try {
      return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64'))) as SmtpConfig
    } catch {
      throw new Error('邮箱配置无法解密，可能由其他系统用户创建，请重新配置')
    }
  }

  // Migrate settings written by versions before encrypted storage was added.
  const legacy = store.get('smtp')
  if (legacy) {
    saveSmtpConfig(legacy)
    return legacy
  }
  return null
}

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

ipcMain.handle('config:get', () => getSmtpConfig())
ipcMain.handle('config:save', (_e, config: SmtpConfig) => { saveSmtpConfig(config); return true })
ipcMain.handle('files:pick', async (_e, kindle: boolean) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: kindle ? [{ name: 'Kindle 支持的文件', extensions: KINDLE_EXTENSIONS.map(x => x.slice(1)) }] : undefined })
  return result.canceled ? [] : result.filePaths
})
ipcMain.handle('ebook:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '电子书', extensions: EBOOK_EXTENSIONS.map(x => x.slice(1)) }]
  })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('ebook:read', async (_e, filePath: string) => {
  if (!EBOOK_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) throw new Error('仅支持 EPUB、MOBI 和 AZW3 文件')
  return readFile(filePath)
})
ipcMain.handle('kindle:send', async (_e, files: string[], recipients: string[]) => {
  const config = getSmtpConfig(); if (!config) throw new Error('请先完成 SMTP 配置')
  await sendToKindle(config, files, recipients); return true
})
ipcMain.handle('share:start', async (_e, files: string[]) => {
  const info = await share.start(files)
  return { ...info, qrDataUrl: await QRCode.toDataURL(info.url, { width: 260, margin: 1 }) }
})
ipcMain.handle('share:stop', () => share.stop())
