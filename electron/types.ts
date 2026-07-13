export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from: string
  recipients: string[]
}

export interface SharedFile { name: string; path: string; size: number; type: string }
