import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  CopyRequest,
  CopyResult,
  CopyResultItem,
  IpcResult,
  ProfileFacets,
  ProfileFilters,
  ProfileListPage,
  Department,
  LogEntry,
  CsvStatus,
  CsvSample,
  Organization
} from '@shared/types'

/** Вызывает IPC и разворачивает IpcResult: успех → data, ошибка → throw. */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!res.ok) {
    const err = new Error(res.error)
    ;(err as any).code = res.code
    throw err
  }
  return res.data
}

const api = {
  // конфиг
  getConfig: () => invoke<AppConfig>('config:get'),
  saveConfig: (patch: Partial<AppConfig>) => invoke<AppConfig>('config:save', patch),
  pickServiceAccountFile: () => invoke<string | null>('config:pickServiceAccount'),

  // профили
  listProfiles: (filters: ProfileFilters) =>
    invoke<ProfileListPage & { pinnedIds: number[] }>('profiles:list', filters),
  getFacets: () => invoke<ProfileFacets>('profiles:facets'),
  pinProfile: (id: number, pinned: boolean) => invoke<number[]>('profiles:pin', id, pinned),

  // проверки
  testDolphin: () => invoke<{ ok: boolean; message: string }>('test:dolphin'),
  testSheets: () =>
    invoke<{ ok: boolean; message: string; freeByDept: Record<Department, number> }>('test:sheets'),

  // копирование
  copyProfile: (req: CopyRequest) => invoke<CopyResult>('copy:run', req),
  onCopyProgress: (cb: (item: CopyResultItem) => void) => {
    const listener = (_e: unknown, item: CopyResultItem) => cb(item)
    ipcRenderer.on('copy:progress', listener)
    return () => {
      ipcRenderer.removeListener('copy:progress', listener)
    }
  },

  // админ-панель / отладка
  adminLogin: (login: string, password: string) =>
    invoke<boolean>('admin:login', login, password),
  getLogs: () => invoke<LogEntry[]>('logs:get'),
  clearLogs: () => invoke<void>('logs:clear'),

  // CSV-рандомизация
  csvStatus: () => invoke<CsvStatus>('csv:status'),
  csvReset: () => invoke<void>('csv:reset'),
  csvPickFile: () => invoke<string | null>('csv:pickFile'),
  csvSample: () => invoke<CsvSample | null>('csv:sample'),
  getOrganization: () => invoke<Organization>('org:get'),
  onLog: (cb: (entry: LogEntry) => void) => {
    const listener = (_e: unknown, entry: LogEntry) => cb(entry)
    ipcRenderer.on('log:entry', listener)
    return () => {
      ipcRenderer.removeListener('log:entry', listener)
    }
  }
}

export type PreloadApi = typeof api

contextBridge.exposeInMainWorld('api', api)
