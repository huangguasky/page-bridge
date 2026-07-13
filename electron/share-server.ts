import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import express from 'express'
import mime from 'mime-types'
import { nanoid } from 'nanoid'
import type { SharedFile } from './types.js'

function localIPv4() {
  const nets = os.networkInterfaces()
  for (const entries of Object.values(nets)) for (const net of entries ?? []) {
    if (net.family === 'IPv4' && !net.internal) return net.address
  }
  return '127.0.0.1'
}

export class ShareServer {
  private server?: http.Server
  private token = ''
  private files: SharedFile[] = []
  private port = 0

  async start(filePaths: string[]) {
    await this.stop()
    this.token = nanoid(12)
    this.files = filePaths.map(file => {
      const stat = fs.statSync(file)
      return { name: path.basename(file), path: file, size: stat.size, type: mime.lookup(file) || 'application/octet-stream' }
    })
    const app = express()
    app.disable('x-powered-by')
    app.get(`/${this.token}`, (_req, res) => res.type('html').send(pageHtml(this.files, this.token)))
    app.get(`/${this.token}/manifest`, (_req, res) => res.json(this.files.map(({ path: _path, ...file }) => file)))
    app.get(`/${this.token}/download/:index`, (req, res) => {
      const file = this.files[Number(req.params.index)]
      if (!file) return res.status(404).send('文件不存在或分享已结束')
      res.download(file.path, file.name)
    })
    this.server = http.createServer(app)
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '0.0.0.0', () => resolve())
    })
    const address = this.server.address()
    this.port = typeof address === 'object' && address ? address.port : 0
    return { url: `http://${localIPv4()}:${this.port}/${this.token}`, files: this.files.map(({ path: _path, ...file }) => file) }
  }

  async stop() {
    if (this.server) await new Promise<void>(resolve => this.server!.close(() => resolve()))
    this.server = undefined
  }
}

function pageHtml(files: SharedFile[], token: string) {
  const cards = files.map((f, i) => `<a class="file" href="/${token}/download/${i}"><span>📄</span><div><b>${escapeHtml(f.name)}</b><small>${formatBytes(f.size)}</small></div><em>下载</em></a>`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page Bridge 接收文件</title><style>body{margin:0;background:#f5f7fb;color:#152033;font:16px system-ui}.wrap{max-width:600px;margin:auto;padding:40px 20px}h1{font-size:28px}.hint{color:#667085}.file{display:flex;align-items:center;gap:14px;margin:14px 0;padding:18px;background:#fff;border-radius:16px;color:inherit;text-decoration:none;box-shadow:0 4px 20px #16213e0d}.file span{font-size:28px}.file div{min-width:0;flex:1}.file b,.file small{display:block;overflow:hidden;text-overflow:ellipsis}.file small{color:#8a94a6;margin-top:5px}.file em{font-style:normal;color:#4864e6;font-weight:700}footer{margin-top:30px;color:#98a2b3;font-size:13px}</style></head><body><main class="wrap"><h1>文件已准备好</h1><p class="hint">点击下方文件，通过当前 Wi-Fi 下载到手机。</p>${cards}<footer>请保持电脑端 Page Bridge 开启。关闭分享后，此地址立即失效。</footer></main></body></html>`
}

const escapeHtml = (s: string) => s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!))
const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`
