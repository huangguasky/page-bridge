/// <reference types="vite/client" />

interface SmtpConfig {
  host: string; port: number; secure: boolean; username: string; password: string; from: string; recipients: string[]
}
interface ShareInfo { url: string; qrDataUrl: string; files: Array<{name:string;size:number;type:string}> }
interface Window {
  pageBridge: {
    getConfig(): Promise<SmtpConfig | null>
    saveConfig(config: SmtpConfig): Promise<boolean>
    pickFiles(kindle?: boolean): Promise<string[]>
    pickEbook(): Promise<string | null>
    readEbook(path: string): Promise<Uint8Array>
    getPathForFile(file: File): string
    sendKindle(files: string[], recipients: string[]): Promise<boolean>
    startShare(files: string[]): Promise<ShareInfo>
    stopShare(): Promise<void>
  }
}
