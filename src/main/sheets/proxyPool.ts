import { google, sheets_v4 } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import type { Department, DepartmentSheetConfig, Proxy } from '@shared/types'

export class ProxyExhaustedError extends Error {
  code = 'proxy_exhausted'
  constructor(sheetTitle: string) {
    super(`Прокси закончились (лист «${sheetTitle}»)`)
    this.name = 'ProxyExhaustedError'
  }
}

export class SheetsError extends Error {
  code = 'sheets_error'
}

export interface ProxyPoolOptions {
  serviceAccountPath: string
  spreadsheetId: string
}

/**
 * Пул прокси в Google-таблице.
 * Один лист = один отдел. Колонка с заголовком proxyHeader ("SOCKS5 RU")
 * содержит IP:Port:Login:Pass, соседняя справа — маркер занятости (пусто/"1").
 */
export class ProxyPool {
  private sheets: sheets_v4.Sheets
  private spreadsheetId: string
  /** Внутрипроцессный лок, чтобы два клона в одной операции не брали одну строку. */
  private localLock: Promise<void> = Promise.resolve()

  constructor(opts: ProxyPoolOptions) {
    const auth = new GoogleAuth({
      keyFile: opts.serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
    this.sheets = google.sheets({ version: 'v4', auth })
    this.spreadsheetId = opts.spreadsheetId
  }

  /** Проверка доступа + подсчёт свободных прокси по каждому листу. */
  async testAndCount(depts: Record<Department, DepartmentSheetConfig>): Promise<{
    ok: boolean
    message: string
    freeByDept: Record<Department, number>
  }> {
    const freeByDept = { 1: 0, 2: 0, 3: 0 } as Record<Department, number>

    // 1) читаем реальные названия вкладок — это и проверка доступа к таблице
    let titles: string[]
    try {
      titles = await this.getSheetTitles()
    } catch (e) {
      return { ok: false, message: describeSheetsError(e), freeByDept }
    }

    // 2) по каждому отделу: есть ли такой лист, находится ли столбец, сколько свободно
    const problems: string[] = []
    for (const d of [1, 2, 3] as Department[]) {
      const cfg = depts[d]
      if (!titles.includes(cfg.sheetTitle)) {
        problems.push(`Отдел ${d}: лист «${cfg.sheetTitle}» не найден`)
        continue
      }
      try {
        const { rows, proxyCol } = await this.loadSheet(cfg)
        const busyCol = proxyCol + 1
        for (let r = cfg.headerRows; r < rows.length; r++) {
          const proxyVal = (rows[r]?.[proxyCol] ?? '').toString().trim()
          const busyVal = (rows[r]?.[busyCol] ?? '').toString().trim()
          if (proxyVal && !busyVal) freeByDept[d]++
        }
      } catch (e) {
        problems.push(`Отдел ${d}: ${describeSheetsError(e)}`)
      }
    }

    const available = `Доступные вкладки таблицы: ${titles.map((t) => `«${t}»`).join(', ')}.`
    if (problems.length > 0) {
      return { ok: false, message: `${problems.join('; ')}. ${available}`, freeByDept }
    }
    return { ok: true, message: `Доступ есть. ${available}`, freeByDept }
  }

  /** Возвращает названия всех вкладок таблицы (для диагностики/валидации). */
  async getSheetTitles(): Promise<string[]> {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties.title'
    })
    return (res.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t)
  }

  /**
   * Берёт первую свободную прокси отдела и помечает её занятой.
   * Защита от гонки: пишем уникальный claim-токен, перечитываем ячейку;
   * если токен наш — нормализуем в "1" и отдаём прокси, иначе идём дальше.
   * @throws ProxyExhaustedError если свободных нет.
   */
  async claim(cfg: DepartmentSheetConfig): Promise<Proxy> {
    // сериализуем claim внутри процесса
    const run = this.localLock.then(() => this.claimInternal(cfg))
    this.localLock = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async claimInternal(cfg: DepartmentSheetConfig): Promise<Proxy> {
    const claimToken = `claim-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { rows, proxyCol } = await this.loadSheet(cfg)
    const busyCol = proxyCol + 1

    for (let r = cfg.headerRows; r < rows.length; r++) {
      const proxyRaw = (rows[r]?.[proxyCol] ?? '').toString().trim()
      const busyRaw = (rows[r]?.[busyCol] ?? '').toString().trim()
      if (!proxyRaw || busyRaw) continue

      const busyA1 = `${quoteSheet(cfg.sheetTitle)}!${colLetter(busyCol)}${r + 1}`

      // 1) ставим claim-токен
      await this.writeCell(busyA1, claimToken)
      // 2) перечитываем — вдруг кто-то перезаписал одновременно
      const after = await this.readCell(busyA1)
      if (after.trim() !== claimToken) continue // проиграли гонку — следующая строка
      // 3) нормализуем в "1"
      await this.writeCell(busyA1, '1')

      const proxy = parseProxy(proxyRaw)
      proxy.sourceRow = r + 1
      proxy.sheetTitle = cfg.sheetTitle
      return proxy
    }

    throw new ProxyExhaustedError(cfg.sheetTitle)
  }

  // ── низкоуровневое ──────────────────────────────────────────────────────────
  private async loadSheet(
    cfg: DepartmentSheetConfig
  ): Promise<{ rows: string[][]; proxyCol: number }> {
    let res
    try {
      res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: quoteSheet(cfg.sheetTitle), // весь лист (имя в кавычках — из-за пробелов/кириллицы)
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
    } catch (e) {
      throw new SheetsError(describeSheetsError(e))
    }
    const rows = (res.data.values ?? []) as string[][]

    // ищем колонку прокси по заголовку в пределах headerRows
    let proxyCol = -1
    for (let r = 0; r < Math.max(cfg.headerRows, 1); r++) {
      const header = rows[r] ?? []
      const idx = header.findIndex(
        (c) => (c ?? '').toString().trim().toLowerCase() === cfg.proxyHeader.trim().toLowerCase()
      )
      if (idx !== -1) {
        proxyCol = idx
        break
      }
    }
    if (proxyCol === -1)
      throw new SheetsError(
        `На листе «${cfg.sheetTitle}» не найден столбец «${cfg.proxyHeader}» в заголовке.`
      )

    return { rows, proxyCol }
  }

  private async writeCell(a1: string, value: string): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: a1,
      // USER_ENTERED: "1" сохраняется как ЧИСЛО 1 (а не текст '1);
      // claim-токен остаётся текстом, т.к. не парсится в число.
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] }
    })
  }

  private async readCell(a1: string): Promise<string> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: a1,
      valueRenderOption: 'UNFORMATTED_VALUE'
    })
    return (res.data.values?.[0]?.[0] ?? '').toString()
  }
}

// ── утилиты ────────────────────────────────────────────────────────────────────
/**
 * Оборачивает имя листа в одинарные кавычки для A1-нотации.
 * Обязательно, если в имени есть пробелы/кириллица/спецсимволы (иначе API → 400).
 * Внутренние одинарные кавычки экранируются удвоением.
 */
function quoteSheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

/** Индекс колонки (0-based) → буква A1 (0→A, 26→AA). */
function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** "IP:Port:Login:Pass" → Proxy. Пароль может содержать ":" — забираем остаток. */
function parseProxy(raw: string): Proxy {
  const parts = raw.split(':')
  const host = (parts[0] ?? '').trim()
  const port = parseInt((parts[1] ?? '').trim(), 10)
  const login = parts[2]?.trim() || undefined
  const password = parts.length > 3 ? parts.slice(3).join(':').trim() : undefined
  if (!host || Number.isNaN(port))
    throw new SheetsError(`Некорректный формат прокси: "${raw}" (ожидается IP:Port:Login:Pass)`)
  return { type: 'socks5', host, port, login, password }
}

function describeSheetsError(e: unknown): string {
  const err = e as any
  const status = err?.code ?? err?.response?.status
  const msg = err?.errors?.[0]?.message ?? err?.message ?? String(e)
  if (status === 403)
    return `Нет доступа к таблице (403). Проверьте, что таблица расшарена на service-account с ролью Editor. ${msg}`
  if (status === 404) return `Таблица не найдена (404). Проверьте spreadsheetId. ${msg}`
  if (status === 400) return `Ошибка запроса (400): возможно, неверное имя листа. ${msg}`
  return msg
}
