import { useEffect, useState } from 'react'
import type { AppConfig, CsvStatus, Department } from '@shared/types'
import { REGION_LABELS } from '@shared/types'
import { Card, Field, Input, Button, Badge } from '../components/ui'
import { useConfig } from '../lib/useConfig'
import { useToast } from '../components/toast'

export function SettingsPage(): JSX.Element {
  const { config, save } = useConfig()
  const toast = useToast()
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [testingD, setTestingD] = useState(false)
  const [testingS, setTestingS] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [freeByDept, setFreeByDept] = useState<Record<Department, number> | null>(null)
  const [csv, setCsv] = useState<CsvStatus | null>(null)

  const refreshCsv = async (): Promise<void> => {
    try {
      setCsv(await window.api.csvStatus())
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void refreshCsv()
  }, [])

  useEffect(() => {
    if (config) setDraft(config)
  }, [config])

  if (!draft) return <div className="p-6 text-slate-500">Загрузка…</div>

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await save({
        dolphin: draft.dolphin,
        google: draft.google,
        departments: draft.departments
      })
      toast('success', 'Настройки сохранены')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pickFile = async (): Promise<void> => {
    const path = await window.api.pickServiceAccountFile()
    if (path) setDraft({ ...draft, google: { ...draft.google, serviceAccountPath: path } })
  }

  const testDolphin = async (): Promise<void> => {
    setTestingD(true)
    try {
      await save({ dolphin: draft.dolphin }) // сохраняем перед проверкой
      const res = await window.api.testDolphin()
      toast(res.ok ? 'success' : 'error', res.message)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setTestingD(false)
    }
  }

  const testSheets = async (): Promise<void> => {
    setTestingS(true)
    try {
      await save({ google: draft.google, departments: draft.departments })
      const res = await window.api.testSheets()
      setFreeByDept(res.ok ? res.freeByDept : null)
      toast(res.ok ? 'success' : 'error', res.message)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setTestingS(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-100">Настройки</h2>
        <Button variant="primary" onClick={onSave} loading={saving}>
          Сохранить всё
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto px-6 py-5">
        {/* DolphinAnty */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
              DolphinAnty API
            </h3>
            <Button variant="outline" onClick={testDolphin} loading={testingD}>
              Проверить токен
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Field label="API-токен" hint="Dolphin панель → API → создать токен">
              <div className="flex gap-2">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="eyJ0eXAiOi…"
                  value={draft.dolphin.apiToken}
                  onChange={(e) =>
                    setDraft({ ...draft, dolphin: { ...draft.dolphin, apiToken: e.target.value } })
                  }
                />
                <Button variant="outline" onClick={() => setShowToken((v) => !v)}>
                  {showToken ? 'Скрыть' : 'Показать'}
                </Button>
              </div>
            </Field>
            <Field label="Base URL" hint="обычно менять не нужно">
              <Input
                value={draft.dolphin.baseUrl}
                onChange={(e) =>
                  setDraft({ ...draft, dolphin: { ...draft.dolphin, baseUrl: e.target.value } })
                }
              />
            </Field>
          </div>
        </Card>

        {/* Google Sheets */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
              Google-таблица (прокси)
            </h3>
            <Button variant="outline" onClick={testSheets} loading={testingS}>
              Проверить доступ
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Service-account JSON" hint="расшарьте таблицу на его email (Editor)">
              <div className="flex gap-2">
                <Input
                  readOnly
                  placeholder="Путь к service-account.json"
                  value={draft.google.serviceAccountPath}
                />
                <Button variant="outline" onClick={pickFile}>
                  Выбрать…
                </Button>
              </div>
            </Field>
            <Field label="ID таблицы" hint="из URL: /spreadsheets/d/&lt;ID&gt;/edit">
              <Input
                placeholder="1AbC…xyz"
                value={draft.google.spreadsheetId}
                onChange={(e) =>
                  setDraft({ ...draft, google: { ...draft.google, spreadsheetId: e.target.value } })
                }
              />
            </Field>
          </div>

          {/* Маппинг регионов */}
          <div className="mt-5 space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Листы регионов
            </div>
            {([1, 2, 3] as Department[]).map((d) => (
              <div key={d} className="grid grid-cols-[90px_1fr_1fr_90px] items-center gap-3">
                <Badge color="indigo">Регион {REGION_LABELS[d]}</Badge>
                <Input
                  placeholder="Название листа"
                  value={draft.departments[d].sheetTitle}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      departments: {
                        ...draft.departments,
                        [d]: { ...draft.departments[d], sheetTitle: e.target.value }
                      }
                    })
                  }
                />
                <Input
                  placeholder="Заголовок столбца прокси"
                  value={draft.departments[d].proxyHeader}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      departments: {
                        ...draft.departments,
                        [d]: { ...draft.departments[d], proxyHeader: e.target.value }
                      }
                    })
                  }
                />
                <div className="text-center">
                  {freeByDept ? (
                    <Badge color={freeByDept[d] > 0 ? 'green' : 'rose'}>
                      {freeByDept[d]} своб.
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-500">
              Маркер занятости — соседний столбец справа от столбца прокси (пусто / «1»).
            </p>
          </div>
        </Card>

        {/* CSV-рандомизация */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
              CSV: рандомизация UA / MAC / Device Name
            </h3>
            <Button variant="outline" onClick={refreshCsv}>
              Обновить статус
            </Button>
          </div>
          <Field
            label="Файл CSV"
            hint="колонки: user_agent, mac_address, device_name"
          >
            <div className="flex gap-2">
              <Input
                readOnly
                placeholder="Авто-поиск рядом с приложением, либо выберите файл"
                value={draft.randomization.csvPath}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  const p = await window.api.csvPickFile()
                  if (p) {
                    setDraft({ ...draft, randomization: { ...draft.randomization, csvPath: p } })
                    await save({ randomization: { csvPath: p } })
                    await refreshCsv()
                  }
                }}
              >
                Выбрать…
              </Button>
            </div>
          </Field>

          <div className="mt-4 flex items-center gap-3">
            {csv ? (
              csv.ok ? (
                <>
                  <Badge color="green">Всего {csv.total}</Badge>
                  <Badge color="amber">Использовано {csv.used}</Badge>
                  <Badge color="indigo">Свободно {csv.free}</Badge>
                  <Button variant="outline" className="ml-auto" onClick={async () => {
                    await window.api.csvReset()
                    await refreshCsv()
                    toast('success', 'Трекинг использованных строк сброшен')
                  }}>
                    Сбросить использованные
                  </Button>
                </>
              ) : (
                <Badge color="rose">{csv.message}</Badge>
              )
            ) : (
              <span className="text-xs text-slate-600">Статус не загружен</span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Включается галочкой в «Базовые настройки» → тогда UA, MAC и Device Name берутся из CSV
            без повторов (по одной строке на профиль). Когда свободные строки кончаются — пул
            сбрасывается автоматически.
          </p>
        </Card>
      </div>
    </div>
  )
}
