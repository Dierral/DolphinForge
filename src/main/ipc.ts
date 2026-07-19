import { ipcMain, dialog, BrowserWindow } from 'electron'
import type {
  AppConfig,
  CopyRequest,
  Department,
  IpcResult,
  ProfileFilters
} from '@shared/types'
import { getConfig, saveConfig, setPinned } from './config/store'
import { DolphinClient } from './dolphin/client'
import { ProxyPool } from './sheets/proxyPool'
import { CsvPool } from './csv/csvPool'
import { copyProfile } from './services/copyProfile'
import { logger } from './logger'

// Учётные данные админ-панели (по требованию заказчика).
const ADMIN_LOGIN = 'F4rm4ceft'
const ADMIN_PASSWORD = 'Poipoipo_123123'

// ── фабрики клиентов из текущего конфига ──────────────────────────────────────
function makeDolphin(cfg: AppConfig): DolphinClient {
  if (!cfg.dolphin.apiToken) throw new Error('Не задан API-токен Dolphin (Настройки).')
  return new DolphinClient({ token: cfg.dolphin.apiToken, baseUrl: cfg.dolphin.baseUrl })
}

function makeProxyPool(cfg: AppConfig): ProxyPool {
  if (!cfg.google.serviceAccountPath)
    throw new Error('Не указан путь к service-account JSON (Настройки).')
  if (!cfg.google.spreadsheetId) throw new Error('Не указан ID Google-таблицы (Настройки).')
  return new ProxyPool({
    serviceAccountPath: cfg.google.serviceAccountPath,
    spreadsheetId: cfg.google.spreadsheetId
  })
}

function makeCsvPool(cfg: AppConfig): CsvPool {
  return new CsvPool(cfg.randomization.csvPath)
}

/** Обёртка: любой хендлер возвращает IpcResult, чтобы renderer единообразно ловил ошибки. */
function handle<T>(channel: string, fn: (...args: any[]) => Promise<T>): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e), code: e?.code }
    }
  })
}

export function registerIpc(): void {
  // ── конфиг ──
  handle('config:get', async () => getConfig())
  handle('config:save', async (patch: Partial<AppConfig>) => saveConfig(patch))
  handle('config:pickServiceAccount', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите service-account JSON',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    return res.canceled ? null : res.filePaths[0]
  })

  // ── профили ──
  handle('profiles:list', async (filters: ProfileFilters) => {
    const cfg = getConfig()
    const page = await makeDolphin(cfg).listProfiles(filters)
    // закреплённые — наверх
    const pinned = new Set(cfg.pinnedProfileIds)
    page.items.sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)))
    return { ...page, pinnedIds: cfg.pinnedProfileIds }
  })
  handle('profiles:facets', async () => makeDolphin(getConfig()).getFacets())
  handle('org:get', async () => {
    const d = makeDolphin(getConfig())
    const [facets, folders] = await Promise.all([d.getFacets(), d.getFolders()])
    return { folders, statuses: facets.statuses }
  })
  handle('profiles:pin', async (id: number, pinned: boolean) => setPinned(id, pinned))

  // ── проверки соединений ──
  handle('test:dolphin', async () => makeDolphin(getConfig()).testConnection())
  handle('test:sheets', async () => {
    const cfg = getConfig()
    return makeProxyPool(cfg).testAndCount(cfg.departments)
  })

  // ── копирование ──
  handle('copy:run', async (req: CopyRequest) => {
    const cfg = getConfig()
    const dolphin = makeDolphin(cfg)
    const proxyPool = makeProxyPool(cfg)
    const bs = cfg.baseSettings
    const csvPool =
      bs.randomizeUa || bs.randomizeMac || bs.randomizeDevice ? makeCsvPool(cfg) : undefined
    const sender = BrowserWindow.getFocusedWindow()?.webContents
    return copyProfile(req, {
      dolphin,
      proxyPool,
      csvPool,
      config: cfg,
      onProgress: (item) => sender?.send('copy:progress', item)
    })
  })

  // ── CSV-рандомизация ──
  handle('csv:status', async () => makeCsvPool(getConfig()).status())
  handle('csv:sample', async () => {
    try {
      return await makeCsvPool(getConfig()).sample()
    } catch {
      return null
    }
  })
  handle('csv:reset', async () => {
    await makeCsvPool(getConfig()).reset()
  })
  handle('csv:pickFile', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите CSV (user_agent, mac_address, device_name)',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    return res.canceled ? null : res.filePaths[0]
  })

  // ── админ-панель / отладка ──
  handle('admin:login', async (login: string, password: string) => {
    const ok = login === ADMIN_LOGIN && password === ADMIN_PASSWORD
    logger.info('admin', ok ? 'Вход в админ-панель выполнен' : 'Неудачная попытка входа в админ-панель')
    return ok
  })
  handle('logs:get', async () => logger.getAll())
  handle('logs:clear', async () => {
    logger.clear()
    logger.info('admin', 'Логи очищены')
  })
}

/** Валидация отдела на входе (защита от кривых данных из renderer). */
export function isDepartment(x: unknown): x is Department {
  return x === 1 || x === 2 || x === 3
}
