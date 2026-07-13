import path from 'node:path'
import nodemailer from 'nodemailer'
import type { SmtpConfig } from './types.js'

export const KINDLE_EXTENSIONS = ['.epub', '.pdf', '.doc', '.docx', '.rtf', '.txt', '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.bmp']

export function validateKindleFiles(paths: string[]): string[] {
  return paths.filter(file => !KINDLE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
}

export async function sendToKindle(config: SmtpConfig, files: string[], recipients: string[]) {
  const invalid = validateKindleFiles(files)
  if (invalid.length) throw new Error(`Kindle 不支持这些文件：${invalid.map(file => path.basename(file)).join('、')}`)
  if (!recipients.length) throw new Error('请至少选择一个 Kindle 邮箱')
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: { user: config.username, pass: config.password }
  })
  await transport.verify()
  const attachments = files.map(file => ({ filename: path.basename(file), path: file }))
  for (const to of recipients) {
    await transport.sendMail({ from: config.from || config.username, to, subject: 'Send to Kindle', text: '由 Page Bridge 发送到 Kindle。', attachments })
  }
}
