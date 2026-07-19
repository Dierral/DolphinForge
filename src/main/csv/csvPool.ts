import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { logger } from '../logger'

export interface CsvRow {
  index: number
  user_agent: string
  mac_address: string
  device_name: string
}

export class CsvError extends Error {
  code = 'csv_error'
}

/**
 * Пул строк из user_agents_mac_devices.csv (колонки: user_agent, mac_address, device_name).
 * Выдаёт строки БЕЗ повторов; когда неиспользованные кончаются — сбрасывает пул.
 * Список использованных индексов хранится персистентно в userData/csv-used.json.
 */
export class CsvPool {
  private path: string
  private rows: CsvRow[] | null = null
  private usedFile: string

  constructor(csvPath: string) {
    this.path = resolveCsvPath(csvPath)
    this.usedFile = join(app.getPath('userData'), 'csv-used.json')
  }

  private async load(): Promise<CsvRow[]> {
    if (this.rows) return this.rows
    if (!this.path || !existsSync(this.path))
      throw new CsvError(
        `CSV-файл не найден: «${this.path || '(путь не задан)'}». Укажите путь в Настройках.`
      )
    let text: string
    try {
      text = await readFile(this.path, 'utf8')
    } catch (e) {
      throw new CsvError(`Не удалось прочитать CSV: ${(e as Error).message}`)
    }
    this.rows = parseCsv(text)
    if (this.rows.length === 0) throw new CsvError('CSV пуст (нет строк данных)')
    return this.rows
  }

  private async readUsed(rowCount: number): Promise<Set<number>> {
    try {
      const raw = JSON.parse(await readFile(this.usedFile, 'utf8')) as {
        rowCount: number
        used: number[]
      }
      // если файл изменился (изменилось число строк) — сбрасываем трекинг
      if (raw.rowCount !== rowCount) return new Set()
      return new Set(raw.used)
    } catch {
      return new Set()
    }
  }

  private async writeUsed(rowCount: number, used: Set<number>): Promise<void> {
    try {
      await writeFile(this.usedFile, JSON.stringify({ rowCount, used: [...used] }))
    } catch (e) {
      logger.warn('csv', `Не удалось сохранить csv-used.json: ${(e as Error).message}`)
    }
  }

  /** Берёт случайную неиспользованную строку, помечает использованной. При исчерпании — сброс. */
  async pick(): Promise<CsvRow> {
    const rows = await this.load()
    let used = await this.readUsed(rows.length)

    if (used.size >= rows.length) {
      logger.info('csv', `Все ${rows.length} строк использованы — сброс пула, начинаю заново`)
      used = new Set()
    }

    const freeIdx: number[] = []
    for (let i = 0; i < rows.length; i++) if (!used.has(i)) freeIdx.push(i)

    const pick = freeIdx[Math.floor(Math.random() * freeIdx.length)]
    used.add(pick)
    await this.writeUsed(rows.length, used)
    logger.debug('csv', `Взята строка #${pick + 1} (осталось свободных ${freeIdx.length - 1})`)
    return rows[pick]
  }

  /** Случайная строка БЕЗ пометки использованной (для кнопки «сгенерировать» в UI). */
  async sample(): Promise<CsvRow> {
    const rows = await this.load()
    return rows[Math.floor(Math.random() * rows.length)]
  }

  /** Статус пула: путь, всего строк, использовано, осталось. */
  async status(): Promise<{
    ok: boolean
    message: string
    path: string
    total: number
    used: number
    free: number
  }> {
    try {
      const rows = await this.load()
      const used = await this.readUsed(rows.length)
      return {
        ok: true,
        message: 'CSV подключён.',
        path: this.path,
        total: rows.length,
        used: used.size,
        free: rows.length - used.size
      }
    } catch (e) {
      return { ok: false, message: (e as Error).message, path: this.path, total: 0, used: 0, free: 0 }
    }
  }

  /** Сброс трекинга использованных строк. */
  async reset(): Promise<void> {
    try {
      await writeFile(this.usedFile, JSON.stringify({ rowCount: 0, used: [] }))
      logger.info('csv', 'Трекинг использованных строк сброшен')
    } catch {
      /* игнорируем */
    }
  }
}

// ── утилиты ────────────────────────────────────────────────────────────────────
/** Ищет CSV: сначала явный путь из конфига, затем рядом с приложением/проектом. */
function resolveCsvPath(configured: string): string {
  if (configured && existsSync(configured)) return configured
  const candidates = [
    join(process.cwd(), 'user_agents_mac_devices.csv'),
    join(app.getAppPath(), 'user_agents_mac_devices.csv'),
    join(process.resourcesPath ?? '', 'user_agents_mac_devices.csv')
  ]
  for (const c of candidates) if (c && existsSync(c)) return c
  return configured || candidates[0]
}

/** Минимальный CSV-парсер с поддержкой кавычек и запятых внутри значений. */
function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length <= 1) return []

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const uaI = header.indexOf('user_agent')
  const macI = header.indexOf('mac_address')
  const devI = header.indexOf('device_name')
  if (uaI === -1 || macI === -1 || devI === -1)
    throw new CsvError('В CSV нужны колонки: user_agent, mac_address, device_name')

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const ua = (cols[uaI] ?? '').trim()
    const mac = (cols[macI] ?? '').trim()
    const dev = (cols[devI] ?? '').trim()
    if (!ua && !mac && !dev) continue
    rows.push({ index: rows.length, user_agent: ua, mac_address: mac, device_name: dev })
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
  }
  out.push(cur)
  return out
}
