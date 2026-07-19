/**
 * Общие типы между main-процессом (backend) и renderer (GUI).
 * Здесь же — ПОЛНОЕ зеркало настроек профиля DolphinAnty («Базовые настройки профиля»).
 * Порядок полей повторяет порядок в UI Dolphin, чтобы вкладка настроек была 1-в-1.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Регионы (внутренне 1/2/3, отображаются как номера регионов)
// ─────────────────────────────────────────────────────────────────────────────
export type Department = 1 | 2 | 3

/** Отображаемые названия регионов. */
export const REGION_LABELS: Record<Department, string> = {
  1: '624',
  2: '726',
  3: '859'
}

// ─────────────────────────────────────────────────────────────────────────────
// Список профилей и фильтры (соответствуют query-параметрам Dolphin)
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfileListItem {
  id: number
  name: string
  tags: string[]
  status?: { id: number; name: string; color?: string } | null
  mainWebsite?: string | null
  /** Владелец профиля (Dolphin user) */
  user?: { id: number; username?: string } | null
  proxy?: { id?: number; name?: string; host?: string } | null
  notes?: string | null
  createdAt?: string
}

export interface ProfileFilters {
  /** Строка поиска (Dolphin: query) */
  query?: string
  tags?: string[]
  statuses?: number[]
  mainWebsites?: string[]
  users?: number[]
  page?: number
  limit?: number
}

export interface ProfileListPage {
  items: ProfileListItem[]
  page: number
  limit: number
  total: number
}

/** Справочники для наполнения фильтров (собираются из /browser_profiles/... Dolphin) */
export interface ProfileFacets {
  tags: string[]
  statuses: { id: number; name: string; color?: string }[]
  mainWebsites: string[]
  users: { id: number; username?: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Прокси
// ─────────────────────────────────────────────────────────────────────────────
export interface Proxy {
  type: 'socks5'
  host: string
  port: number
  login?: string
  password?: string
  /** Из какой строки листа взят — для диагностики/логов */
  sourceRow?: number
  sheetTitle?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// БАЗОВЫЕ НАСТРОЙКИ ПРОФИЛЯ — полное зеркало Dolphin.
// Каждое поле имеет те же режимы (real/manual/auto/mask/off), что и в Dolphin.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'windows' | 'macos' | 'linux'

/** Общий шаблон «режим + значение» */
export interface ModeValue<M extends string, V = string> {
  mode: M
  value?: V
}

export interface BaseProfileSettings {
  // — Основное / Platform —
  platform: Platform
  /** Версия ОС (Windows: 7/8/8.1/10/11; macOS: 11..15; Linux: '') */
  osVersion: string

  // — Рандомизация из CSV (отдельный флаг на каждый параметр) —
  /** UA берётся из CSV (без повторов), ручной выбор блокируется */
  randomizeUa: boolean
  /** MAC берётся из CSV */
  randomizeMac: boolean
  /** Device Name берётся из CSV */
  randomizeDevice: boolean

  // — Организация: папка и статус Dolphin для копий (null — не задавать) —
  folderId: number | null
  statusId: number | null

  // — User-Agent —
  useragent: {
    mode: 'manual' | 'auto'
    value?: string
  }

  // — CPU (кол-во ядер) —
  cpu: {
    mode: 'manual' | 'real'
    value?: number // напр. 2,4,8,16
  }

  // — Memory / RAM (ГБ) —
  memory: {
    mode: 'manual' | 'real'
    value?: number // напр. 2,4,8,16
  }

  // — Screen (разрешение) —
  screen: {
    mode: 'manual' | 'real'
    resolution?: string // "1920x1080"
  }

  // — Timezone —
  timezone: {
    mode: 'auto' | 'manual'
    value?: string // "Europe/Moscow"
  }

  // — Language / Locale —
  locale: {
    mode: 'auto' | 'manual'
    value?: string // "ru-RU,ru;q=0.9,en-US;q=0.8"
  }

  // — Geolocation —
  geolocation: {
    mode: 'auto' | 'manual'
    latitude?: number
    longitude?: number
    accuracy?: number
  }

  // — WebRTC —
  webrtc: {
    mode: 'altered' | 'real' | 'manual' | 'udpDisabled'
    ipAddress?: string // для manual
  }

  // — Canvas —
  canvas: {
    mode: 'noise' | 'real' | 'off'
  }

  // — WebGL (image) —
  webgl: {
    mode: 'noise' | 'real' | 'off'
  }

  // — WebGL Info (vendor/renderer) —
  webglInfo: {
    mode: 'manual' | 'real'
    vendor?: string
    renderer?: string
  }

  // — WebGPU —
  webgpu: {
    mode: 'manual' | 'real' | 'off'
  }

  // — Client Rects —
  clientRect: {
    mode: 'noise' | 'real' | 'off'
  }

  // — MAC-адрес —
  macAddress: {
    mode: 'manual' | 'auto' | 'off'
    value?: string
  }

  // — Device Name —
  deviceName: {
    mode: 'manual' | 'auto' | 'off'
    value?: string
  }

  // — Fonts —
  fonts: {
    mode: 'real' | 'manual'
    value?: string[] // список при manual
  }

  // — Media Devices —
  mediaDevices: {
    mode: 'manual' | 'real'
    audioInputs?: number // микрофоны
    audioOutputs?: number // динамики
    videoInputs?: number // камеры
  }

  // — Audio (AudioContext) —
  audio: {
    mode: 'noise' | 'real' | 'off'
  }

  // — Ports —
  ports: {
    mode: 'protect' | 'real'
    blacklist?: number[] // список портов
  }

  // — Do Not Track —
  doNotTrack: boolean

  // — Аргументы запуска —
  args: string[]

  // — Флаги —
  /** Скрыть название в браузере */
  hideBrowserName: boolean
  /** Подмена видеопотока */
  maskVideoStream: boolean
  /** Подмена куки (по видеопотоку/сессии) */
  maskCookies: boolean
  /** Подменять имя и значок БП */
  maskBrowserProfileNameIcon: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Операция «Копировать»
// ─────────────────────────────────────────────────────────────────────────────
export interface CopyRequest {
  sourceId: number
  /** Новое (базовое) имя; при count>1 к копиям добавляется суффикс */
  baseName: string
  count: number // обычно ≤ 3
  department: Department
}

export type CopyStepStatus = 'pending' | 'running' | 'done' | 'error'

export interface CopyResultItem {
  index: number
  name: string
  ok: boolean
  cloneId?: number
  proxy?: Pick<Proxy, 'host' | 'port' | 'sourceRow'>
  /** машинный код ошибки: 'proxy_exhausted' | 'clone_failed' | 'update_failed' | ... */
  errorCode?: string
  errorMessage?: string
}

export interface CopyResult {
  items: CopyResultItem[]
  /** true, если операция остановлена из-за нехватки прокси */
  stoppedProxyExhausted: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация приложения
// ─────────────────────────────────────────────────────────────────────────────
export interface DepartmentSheetConfig {
  /** Название листа (вкладки) в таблице для этого отдела */
  sheetTitle: string
  /**
   * Заголовок столбца с прокси. По нему находим колонку.
   * По умолчанию "SOCKS5 RU". Маркер занятости — соседний столбец справа.
   */
  proxyHeader: string
  /** Сколько верхних строк занимает заголовок (обычно 1) */
  headerRows: number
}

export interface AppConfig {
  dolphin: {
    apiToken: string
    /** База Remote API (по умолчанию https://dolphin-anty-api.com) */
    baseUrl: string
  }
  google: {
    /** Путь к service-account JSON на диске сотрудника */
    serviceAccountPath: string
    /** ID Google-таблицы (из URL) */
    spreadsheetId: string
  }
  departments: Record<Department, DepartmentSheetConfig>
  /** Рандомизация из CSV */
  randomization: {
    /** Путь к CSV (user_agent,mac_address,device_name). Пусто → авто-поиск рядом с приложением */
    csvPath: string
  }
  /** Закреплённые сверху профили (id) */
  pinnedProfileIds: number[]
  /** Базовые настройки, применяемые к каждому клону */
  baseSettings: BaseProfileSettings
}

// ─────────────────────────────────────────────────────────────────────────────
// Логи / отладка (админ-панель)
// ─────────────────────────────────────────────────────────────────────────────
export interface LogEntry {
  id: number
  ts: string
  level: 'debug' | 'info' | 'warn' | 'error'
  scope: string
  message: string
  data?: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Контракт IPC (renderer ↔ main). Реализуется в preload как window.api.*
// ─────────────────────────────────────────────────────────────────────────────
export interface Api {
  // конфиг
  getConfig(): Promise<AppConfig>
  saveConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  pickServiceAccountFile(): Promise<string | null>

  // профили
  listProfiles(filters: ProfileFilters): Promise<ProfileListPage>
  getFacets(): Promise<ProfileFacets>
  pinProfile(id: number, pinned: boolean): Promise<number[]>

  // проверки соединений
  testDolphin(): Promise<{ ok: boolean; message: string }>
  testSheets(): Promise<{ ok: boolean; message: string; freeByDept: Record<Department, number> }>

  // операция копирования
  copyProfile(req: CopyRequest): Promise<CopyResult>

  // админ-панель / отладка
  adminLogin(login: string, password: string): Promise<boolean>
  getLogs(): Promise<LogEntry[]>
  clearLogs(): Promise<void>

  // CSV-рандомизация
  csvStatus(): Promise<CsvStatus>
  csvReset(): Promise<void>
  csvPickFile(): Promise<string | null>
  csvSample(): Promise<CsvSample | null>

  // папки/статусы Dolphin
  getOrganization(): Promise<Organization>
}

export interface CsvSample {
  user_agent: string
  mac_address: string
  device_name: string
}

/** Папки и статусы Dolphin для селектов «Организация» */
export interface Organization {
  folders: { id: number; name: string }[]
  statuses: { id: number; name: string; color?: string }[]
}

export interface CsvStatus {
  ok: boolean
  message: string
  path: string
  total: number
  used: number
  free: number
}

/** Результат-обёртка для унифицированной обработки ошибок в IPC */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }
