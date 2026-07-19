import Store from 'electron-store'
import type { AppConfig, Department } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/defaults'

/**
 * Персистентный конфиг приложения (в %APPDATA%/AutoDolphin/config.json).
 * Хранит токен Dolphin, путь к service-account, маппинг отделов, закреплённые id,
 * и базовые настройки профиля.
 */
const store = new Store<AppConfig>({
  name: 'config',
  defaults: DEFAULT_CONFIG,
  // Небольшая защита от «сырого» чтения файла третьими лицами.
  // Это не криптостойкость, а обфускация — для настоящей защиты храните на зашифрованном диске.
  encryptionKey: 'autodolphin-local'
})

/** Глубокое слияние с дефолтами — чтобы новые поля не ломали старый конфиг. */
function withDefaults(cfg: AppConfig): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    dolphin: { ...DEFAULT_CONFIG.dolphin, ...cfg.dolphin },
    google: { ...DEFAULT_CONFIG.google, ...cfg.google },
    departments: {
      1: { ...DEFAULT_CONFIG.departments[1], ...cfg.departments?.[1] },
      2: { ...DEFAULT_CONFIG.departments[2], ...cfg.departments?.[2] },
      3: { ...DEFAULT_CONFIG.departments[3], ...cfg.departments?.[3] }
    },
    randomization: { ...DEFAULT_CONFIG.randomization, ...cfg.randomization },
    pinnedProfileIds: cfg.pinnedProfileIds ?? [],
    baseSettings: { ...DEFAULT_CONFIG.baseSettings, ...cfg.baseSettings }
  }
}

export function getConfig(): AppConfig {
  return withDefaults(store.store)
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const current = getConfig()
  const next = withDefaults({ ...current, ...patch })
  store.store = next
  return next
}

export function setPinned(id: number, pinned: boolean): number[] {
  const cfg = getConfig()
  const set = new Set(cfg.pinnedProfileIds)
  if (pinned) set.add(id)
  else set.delete(id)
  const list = [...set]
  saveConfig({ pinnedProfileIds: list })
  return list
}

export function getDepartmentConfig(dept: Department) {
  return getConfig().departments[dept]
}
