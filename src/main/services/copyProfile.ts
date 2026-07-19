import type { AppConfig, BaseProfileSettings, CopyRequest, CopyResult, CopyResultItem } from '@shared/types'
import { DolphinClient, DolphinError } from '../dolphin/client'
import { ProxyPool, ProxyExhaustedError } from '../sheets/proxyPool'
import { CsvPool } from '../csv/csvPool'
import { buildUpdatePayload } from '../domain/profileSettings'
import { logger } from '../logger'

export interface CopyDeps {
  dolphin: DolphinClient
  proxyPool: ProxyPool
  config: AppConfig
  /** пул CSV (нужен, если включена рандомизация UA/MAC/Device) */
  csvPool?: CsvPool
  /** колбэк прогресса для GUI (по желанию) */
  onProgress?: (item: CopyResultItem) => void
}

/**
 * Выполняет операцию «Копировать» для N копий, один клон за другим.
 * На каждую копию: clone (2а) → claim прокси → update (2б).
 * Прокси кончились → откат текущего клона + остановка остальных копий.
 */
export async function copyProfile(req: CopyRequest, deps: CopyDeps): Promise<CopyResult> {
  const { dolphin, proxyPool, config } = deps

  // ── валидация входных данных ──
  if (!Number.isFinite(req.sourceId)) throw new Error('Некорректный профиль-источник')
  if (!req.baseName || !req.baseName.trim()) throw new Error('Укажите имя профиля')
  if (!Number.isInteger(req.count) || req.count < 1 || req.count > 20)
    throw new Error('Количество копий должно быть от 1 до 20')
  if (![1, 2, 3].includes(req.department)) throw new Error('Некорректный отдел')

  const deptCfg = config.departments[req.department]
  if (!deptCfg?.sheetTitle?.trim())
    throw new Error(`Для отдела ${req.department} не задан лист прокси (Настройки)`)

  const items: CopyResultItem[] = []
  let stoppedProxyExhausted = false

  logger.info(
    'copy',
    `Старт: источник #${req.sourceId}, копий ${req.count}, отдел ${req.department} (лист «${deptCfg.sheetTitle}»)`
  )

  for (let i = 0; i < req.count; i++) {
    // индекс всегда в конце имени: «имя 1», «имя 2», …
    const name = `${req.baseName} ${i + 1}`
    const item: CopyResultItem = { index: i, name, ok: false }

    let cloneId: number | undefined
    try {
      // ── шаг 2а: клон ──
      logger.info('copy', `[${i + 1}/${req.count}] Клонирование «${name}»…`)
      const cloned = await dolphin.cloneProfile(req.sourceId, name)
      cloneId = cloned.id
      item.cloneId = cloneId
      logger.info('copy', `[${i + 1}/${req.count}] Клон создан: #${cloneId}`)

      // ── шаг 2б: прокси отдела ──
      logger.info('copy', `[${i + 1}/${req.count}] Беру прокси из листа «${deptCfg.sheetTitle}»…`)
      const proxy = await proxyPool.claim(deptCfg)
      item.proxy = { host: proxy.host, port: proxy.port, sourceRow: proxy.sourceRow }
      logger.info(
        'copy',
        `[${i + 1}/${req.count}] Прокси: ${proxy.host}:${proxy.port} (строка ${proxy.sourceRow})`
      )


      // ── CSV-рандомизация (по отдельному флагу на каждый параметр) ──
      const bs = config.baseSettings
      let effective: BaseProfileSettings = bs
      if (bs.randomizeUa || bs.randomizeMac || bs.randomizeDevice) {
        if (!deps.csvPool) throw new Error('Рандомизация из CSV включена, но файл не подключён')
        const row = await deps.csvPool.pick()
        effective = {
          ...bs,
          useragent: bs.randomizeUa ? { mode: 'manual', value: row.user_agent } : bs.useragent,
          macAddress: bs.randomizeMac ? { mode: 'manual', value: row.mac_address } : bs.macAddress,
          deviceName: bs.randomizeDevice ? { mode: 'manual', value: row.device_name } : bs.deviceName
        }
        const applied = [
          bs.randomizeUa && 'UA',
          bs.randomizeMac && 'MAC',
          bs.randomizeDevice && 'Device'
        ]
          .filter(Boolean)
          .join('/')
        logger.info('copy', `[${i + 1}/${req.count}] CSV: строка #${row.index + 1} → ${applied}`)
      }

      // ── шаг 2б: применяем базовые настройки + прокси ──
      logger.info('copy', `[${i + 1}/${req.count}] Применяю базовые настройки + прокси к #${cloneId}…`)
      const payload = buildUpdatePayload(effective, proxy)
      await dolphin.updateProfile(cloneId, payload)

      item.ok = true
      logger.info('copy', `[${i + 1}/${req.count}] ✓ Готово: «${name}» (#${cloneId})`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('copy', `[${i + 1}/${req.count}] ✗ Ошибка на «${name}»: ${msg}`, {
        cloneId,
        error: msg
      })
      // откат уже созданного клона (прокси, по правилу, не освобождается)
      if (cloneId != null) {
        try {
          await dolphin.deleteProfile(cloneId)
          logger.warn('copy', `[${i + 1}/${req.count}] Откат: клон #${cloneId} удалён`)
          item.cloneId = undefined
        } catch (delErr) {
          logger.error('copy', `[${i + 1}/${req.count}] Не удалось удалить клон #${cloneId} при откате`, {
            error: String(delErr)
          })
        }
      }

      if (e instanceof ProxyExhaustedError) {
        item.errorCode = 'proxy_exhausted'
        item.errorMessage = e.message
        items.push(finalize(item, deps))
        stoppedProxyExhausted = true
        break // нет смысла продолжать остальные копии
      }

      item.errorCode = classifyError(e, cloneId != null)
      item.errorMessage = msg
    }

    items.push(finalize(item, deps))
  }

  logger.info('copy', `Финиш: успешно ${items.filter((i) => i.ok).length} из ${req.count}`)
  return { items, stoppedProxyExhausted }
}

function finalize(item: CopyResultItem, deps: CopyDeps): CopyResultItem {
  deps.onProgress?.(item)
  return item
}

function classifyError(e: unknown, hadClone: boolean): string {
  if (e instanceof DolphinError) {
    // если клон был создан, значит упал именно update/proxy этап
    return hadClone ? 'update_failed' : 'clone_failed'
  }
  return 'unknown'
}
