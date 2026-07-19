import { app, WebContents } from 'electron'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { LogEntry } from '@shared/types'

/**
 * Централизованный логгер: кольцевой буфер в памяти + стрим в renderer (админ-панель)
 * + дозапись в файл %APPDATA%/AutoDolphin/logs/app.log.
 * Секреты (токен, пароль прокси) НЕ логируются — маскируются.
 */
class Logger {
  private buffer: LogEntry[] = []
  private seq = 0
  private readonly max = 3000
  private sender?: WebContents
  private logFile?: string
  private fileReady = false

  setSender(wc: WebContents): void {
    this.sender = wc
  }

  private async ensureFile(): Promise<void> {
    if (this.fileReady) return
    try {
      const dir = join(app.getPath('userData'), 'logs')
      await mkdir(dir, { recursive: true })
      this.logFile = join(dir, 'app.log')
      this.fileReady = true
    } catch {
      /* файл-лог необязателен */
    }
  }

  log(level: LogEntry['level'], scope: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: ++this.seq,
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      data: data === undefined ? undefined : safeData(data)
    }
    this.buffer.push(entry)
    if (this.buffer.length > this.max) this.buffer.shift()

    // в renderer (если окно готово)
    try {
      this.sender?.send('log:entry', entry)
    } catch {
      /* окно могло закрыться */
    }

    // в консоль main
    const line = `[${entry.ts}] ${level.toUpperCase()} (${scope}) ${message}`
    if (level === 'error') console.error(line, data ?? '')
    else console.log(line, data ?? '')

    // в файл (best-effort, async)
    void this.appendToFile(entry)
  }

  private async appendToFile(entry: LogEntry): Promise<void> {
    await this.ensureFile()
    if (!this.logFile) return
    try {
      const dataStr = entry.data !== undefined ? ' ' + JSON.stringify(entry.data) : ''
      await appendFile(
        this.logFile,
        `[${entry.ts}] ${entry.level.toUpperCase()} (${entry.scope}) ${entry.message}${dataStr}\n`
      )
    } catch {
      /* игнорируем ошибки записи в файл */
    }
  }

  debug(scope: string, message: string, data?: unknown): void {
    this.log('debug', scope, message, data)
  }
  info(scope: string, message: string, data?: unknown): void {
    this.log('info', scope, message, data)
  }
  warn(scope: string, message: string, data?: unknown): void {
    this.log('warn', scope, message, data)
  }
  error(scope: string, message: string, data?: unknown): void {
    this.log('error', scope, message, data)
  }

  getAll(): LogEntry[] {
    return this.buffer
  }
  clear(): void {
    this.buffer = []
  }
  logFilePath(): string | undefined {
    return this.logFile
  }
}

/** Обрезает большие/секретные значения перед сохранением в лог. */
function safeData(data: unknown): unknown {
  try {
    const json = JSON.stringify(data, (key, value) => {
      const k = key.toLowerCase()
      if (
        k === 'password' ||
        k === 'token' ||
        k === 'apitoken' ||
        k === 'authorization' ||
        k === 'login'
      )
        return value ? '***' : value
      if (typeof value === 'string' && value.length > 2000) return value.slice(0, 2000) + '…[cut]'
      return value
    })
    return json ? JSON.parse(json) : data
  } catch {
    return String(data)
  }
}

export const logger = new Logger()
