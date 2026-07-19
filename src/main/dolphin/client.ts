import type {
  ProfileFilters,
  ProfileListPage,
  ProfileListItem,
  ProfileFacets
} from '@shared/types'
import { logger } from '../logger'

/** Ошибка Dolphin API с сохранением HTTP-статуса и тела ответа. */
export class DolphinError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'DolphinError'
  }
}

export interface DolphinClientOptions {
  token: string
  baseUrl?: string
  /** Таймаут запроса, мс (по умолчанию 30000) */
  timeoutMs?: number
}

/**
 * Клиент Remote API DolphinAnty.
 * Docs: https://documenter.getpostman.com/view/15402503/Tzm8Fb5f
 * База: https://dolphin-anty-api.com
 */
export class DolphinClient {
  private token: string
  private baseUrl: string
  private timeoutMs: number

  constructor(opts: DolphinClientOptions) {
    if (!opts.token || !opts.token.trim()) throw new Error('Пустой API-токен Dolphin')
    this.token = opts.token.trim()
    this.baseUrl = (opts.baseUrl || 'https://dolphin-anty-api.com').replace(/\/+$/, '')
    this.timeoutMs = opts.timeoutMs ?? 30000
  }

  // ── низкоуровневый запрос ──────────────────────────────────────────────────
  private async request<T = unknown>(
    path: string,
    init: RequestInit & { query?: Record<string, unknown> } = {}
  ): Promise<T> {
    const { query, ...rest } = init
    const url = new URL(this.baseUrl + path)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue
        if (Array.isArray(v)) {
          // Dolphin ждёт повторяющиеся ключи с [] : tags[]=a&tags[]=b
          for (const item of v) url.searchParams.append(`${k}[]`, String(item))
        } else {
          url.searchParams.set(k, String(v))
        }
      }
    }

    const method = rest.method ?? 'GET'
    const shortUrl = url.pathname + url.search
    // тело логируем распарсенным, чтобы logger замаскировал секреты (пароль прокси и т.п.)
    logger.debug(
      'dolphin',
      `→ ${method} ${shortUrl}`,
      rest.body ? { body: tryParse(rest.body) } : undefined
    )

    const maxAttempts = 3
    for (let attempt = 1; ; attempt++) {
      let res: Response
      const started = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        res = await fetch(url, {
          ...rest,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
            ...(rest.headers || {})
          }
        })
      } catch (e) {
        const aborted = (e as Error).name === 'AbortError'
        const msg = aborted
          ? `Таймаут запроса (${this.timeoutMs}мс)`
          : `Сеть недоступна: ${(e as Error).message}`
        logger.error('dolphin', `✗ ${method} ${shortUrl} — ${msg}`, { error: String(e) })
        throw new DolphinError(msg, 0)
      } finally {
        clearTimeout(timer)
      }

      const text = await res.text()
      let json: unknown
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = text
      }
      const ms = Date.now() - started

      // rate-limit → подождать и повторить
      if (res.status === 429 && attempt < maxAttempts) {
        const backoff = 800 * attempt
        logger.warn('dolphin', `429 rate-limit на ${shortUrl}, повтор через ${backoff}мс`)
        await sleep(backoff)
        continue
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        if (json && typeof json === 'object' && 'message' in json) {
          msg = String((json as { message: unknown }).message)
        }
        logger.error('dolphin', `✗ ${method} ${shortUrl} → ${res.status} (${ms}мс): ${msg}`, {
          status: res.status,
          response: json
        })
        throw new DolphinError(msg, res.status, json)
      }

      logger.debug('dolphin', `✓ ${method} ${shortUrl} → ${res.status} (${ms}мс)`)
      return json as T
    }
  }

  // ── проверка соединения ─────────────────────────────────────────────────────
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.request('/browser_profiles', { query: { page: 1, limit: 1 } })
      return { ok: true, message: 'Токен Dolphin валиден, соединение установлено.' }
    } catch (e) {
      const err = e as DolphinError
      if (err.status === 401) return { ok: false, message: 'Неверный или просроченный API-токен (401).' }
      return { ok: false, message: err.message }
    }
  }

  // ── список профилей с фильтрами ─────────────────────────────────────────────
  async listProfiles(filters: ProfileFilters): Promise<ProfileListPage> {
    const page = filters.page ?? 1
    const limit = Math.min(filters.limit ?? 50, 50) // Dolphin отдаёт максимум 50/страницу
    const raw = await this.request<any>('/browser_profiles', {
      query: {
        query: filters.query,
        tags: filters.tags,
        statuses: filters.statuses,
        mainWebsites: filters.mainWebsites,
        users: filters.users,
        page,
        limit
      }
    })

    const data: any[] = raw?.data ?? raw?.items ?? []
    const total: number = raw?.total ?? raw?.meta?.total ?? data.length
    return {
      items: data.map(mapProfile),
      page,
      limit,
      total
    }
  }

  /** Собирает справочники (теги/статусы/сайты/пользователи) для фильтров GUI. */
  async getFacets(): Promise<ProfileFacets> {
    // Dolphin отдаёт справочники внутри мета первой страницы; если нет — агрегируем сами.
    const raw = await this.request<any>('/browser_profiles', { query: { page: 1, limit: 50 } })
    const data: any[] = raw?.data ?? []

    const tags = new Set<string>()
    const statuses = new Map<number, { id: number; name: string; color?: string }>()
    const mainWebsites = new Set<string>()
    const users = new Map<number, { id: number; username?: string }>()

    for (const p of data) {
      for (const t of extractTags(p.tags)) tags.add(t)
      if (p.status?.id != null)
        statuses.set(p.status.id, { id: p.status.id, name: p.status.name, color: p.status.color })
      if (p.mainWebsite) mainWebsites.add(String(p.mainWebsite))
      const u = p.user ?? p.users?.[0]
      if (u?.id != null) users.set(u.id, { id: u.id, username: u.username })
    }

    return {
      tags: [...tags].sort(),
      statuses: [...statuses.values()],
      mainWebsites: [...mainWebsites].sort(),
      users: [...users.values()]
    }
  }

  // ── папки (для организации копий) ────────────────────────────────────────────
  async getFolders(): Promise<{ id: number; name: string }[]> {
    try {
      const raw = await this.request<any>('/folders')
      const data = raw?.data ?? raw ?? []
      if (!Array.isArray(data)) return []
      return data
        .map((f: any) => ({ id: Number(f.id), name: String(f.name ?? f.title ?? f.id) }))
        .filter((f) => Number.isFinite(f.id))
    } catch {
      return []
    }
  }

  // ── чтение одного профиля ───────────────────────────────────────────────────
  async getProfile(id: number): Promise<any> {
    const raw = await this.request<any>(`/browser_profiles/${id}`)
    return raw?.data ?? raw
  }

  // ── создание ────────────────────────────────────────────────────────────────
  async createProfile(payload: Record<string, unknown>): Promise<{ id: number }> {
    const raw = await this.request<any>('/browser_profiles', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    const id = raw?.data?.id ?? raw?.browserProfileId ?? raw?.id
    if (id == null) throw new DolphinError('Создание профиля: API не вернул id', 200, raw)
    return { id: Number(id) }
  }

  // ── обновление (шаг 2б: настройки + прокси) ─────────────────────────────────
  async updateProfile(id: number, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/browser_profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  }

  // ── создание сохранённого прокси (чтобы edit-диалог Dolphin его находил) ─────
  async createProxy(p: {
    type: string
    host: string
    port: number
    login?: string
    password?: string
    name?: string
  }): Promise<number> {
    const raw = await this.request<any>('/proxy', {
      method: 'POST',
      body: JSON.stringify({
        name: p.name ?? `${p.host}:${p.port}`,
        type: p.type,
        host: p.host,
        port: p.port,
        login: p.login ?? '',
        password: p.password ?? ''
      })
    })
    logger.debug('dolphin', 'createProxy ответ', { response: raw })
    const id = raw?.data?.id ?? raw?.id ?? raw?.proxy?.id
    if (id == null) throw new DolphinError('createProxy: API не вернул id', 200, raw)
    return Number(id)
  }

  // ── удаление (откат клона) ──────────────────────────────────────────────────
  async deleteProfile(id: number): Promise<void> {
    await this.request('/browser_profiles', {
      method: 'DELETE',
      query: { ids: [id], forceDelete: 1 }
    })
  }

  // ── КЛОНИРОВАНИЕ (шаг 2а) ────────────────────────────────────────────────────
  /**
   * Стратегия:
   *  1) пробуем нативный POST /browser_profiles/{id}/clone (если он есть в вашей версии API);
   *  2) при 404/405 — фолбэк: GET исходника → POST копии → перенос куки.
   * Фингерпринт исходника не важен: шаг 2б всё равно перезапишет настройки + прокси.
   */
  async cloneProfile(sourceId: number, newName: string): Promise<{ id: number }> {
    try {
      const raw = await this.request<any>(`/browser_profiles/${sourceId}/clone`, {
        method: 'POST',
        body: JSON.stringify({ name: newName })
      })
      const id = raw?.data?.id ?? raw?.id ?? raw?.browserProfileId
      if (id != null) return { id: Number(id) }
      // нет id — уходим в фолбэк
    } catch (e) {
      const err = e as DolphinError
      // 404/405 = нативного clone нет → фолбэк; иные ошибки прокидываем
      if (err.status !== 404 && err.status !== 405) throw err
    }
    return this.cloneFallback(sourceId, newName)
  }

  /** Фолбэк-клон: копирование настроек исходника + перенос куки. */
  private async cloneFallback(sourceId: number, newName: string): Promise<{ id: number }> {
    const src = await this.getProfile(sourceId)
    const payload = stripForCreate(src, newName)
    const created = await this.createProfile(payload)
    // перенос куки — best-effort (если эндпоинт вашей версии отличается, правится в одном месте)
    try {
      const cookies = await this.getCookies(sourceId)
      if (cookies?.length) await this.importCookies(created.id, cookies)
    } catch {
      /* куки перенести не удалось — не валим операцию, профиль уже создан */
    }
    return created
  }

  // ── КУКИ ────────────────────────────────────────────────────────────────────
  // ВНИМАНИЕ: точные маршруты sync/cookies стоит подтвердить на вашем токене.
  // Оба вызова изолированы здесь, чтобы правка была в одном месте.
  async getCookies(profileId: number): Promise<unknown[]> {
    const raw = await this.request<any>(`/browser_profiles/${profileId}/cookies`).catch(() => null)
    return raw?.data ?? raw?.cookies ?? []
  }

  async importCookies(profileId: number, cookies: unknown[]): Promise<void> {
    await this.request(`/browser_profiles/${profileId}/cookies`, {
      method: 'POST',
      body: JSON.stringify({ cookies })
    })
  }

  // ── генерация MAC (для manual при желании) ──────────────────────────────────
  async generateMac(): Promise<string> {
    const raw = await this.request<any>('/browser_profiles/generate-mac')
    return raw?.data ?? raw?.mac ?? raw
  }
}

// ── маппинг ответа Dolphin → наши типы ────────────────────────────────────────
function extractTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags.map((t) => (typeof t === 'string' ? t : (t as any)?.name)).filter(Boolean)
}

function mapProfile(p: any): ProfileListItem {
  return {
    id: Number(p.id),
    name: String(p.name ?? ''),
    tags: extractTags(p.tags),
    status: p.status ? { id: p.status.id, name: p.status.name, color: p.status.color } : null,
    mainWebsite: p.mainWebsite ?? null,
    user: p.user ?? (Array.isArray(p.users) ? p.users[0] : null) ?? null,
    proxy: p.proxy ? { id: p.proxy.id, name: p.proxy.name, host: p.proxy.host } : null,
    notes: p.notes ?? null,
    createdAt: p.createdAt ?? p.created_at
  }
}

/**
 * Готовит payload на создание из полного профиля-исходника:
 * убирает серверные поля (id/даты/владелец) и подставляет новое имя.
 * Прокси намеренно НЕ копируем — он назначается на шаге 2б из пула отдела.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tryParse(body: unknown): unknown {
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

function stripForCreate(src: any, newName: string): Record<string, unknown> {
  const clone = { ...src }
  // серверные / read-only поля
  delete clone.id
  delete clone.createdAt
  delete clone.updatedAt
  delete clone.created_at
  delete clone.updated_at
  delete clone.user
  delete clone.users
  delete clone.proxy
  delete clone.proxyId
  // identity/облачные/runtime поля исходника — иначе 403 E_ACCESS_DENIED_FOR_CLOUD_SYNC:
  // Dolphin пытается засинкать чужое облачное хранилище (storagePath) под чужой командой.
  // Профиль должен создаться «с нуля» под аккаунтом текущего токена.
  for (const f of [
    'teamId',
    'userId',
    'team',
    'access',
    'status', // статус team-scoped; при необходимости назначается отдельно
    'storagePath', // ← главный триггер E_ACCESS_DENIED_FOR_CLOUD_SYNC
    'cloudStorage',
    'cloudSyncDisabled',
    'cloudSyncDisabledOnMachineId',
    'doNotSync',
    'syncStatus',
    'transferStatus',
    'lastRunningTime',
    'lastRunnedByUserId',
    'lastRunUuid',
    'running',
    'mediaDevicesData'
  ]) {
    delete clone[f]
  }

  // Форма чтения (GET) ≠ форма записи (POST). Правим поля, которые POST не принимает как есть:
  // 1) tabs должен быть массивом URL-вкладок (иначе 422 validation.array)
  clone.tabs = Array.isArray(src.tabs) ? src.tabs : []
  // 2) webgpu в объектной форме POST отклоняет (validation.array) —
  //    убираем из создания, настройка накатится на шаге 2б (update).
  delete clone.webgpu

  clone.name = newName
  return clone
}
