import { useEffect, useState } from 'react'
import type { CopyResultItem, Department, ProfileListItem } from '@shared/types'
import { REGION_LABELS } from '@shared/types'
import { Modal, Button, Input, Field, Segmented, Badge, Spinner } from './ui'
import { useToast } from './toast'

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))
const REGION_OPTIONS = ([1, 2, 3] as Department[]).map((d) => ({
  value: d,
  label: REGION_LABELS[d]
}))

export function CopyModal({
  open,
  profile,
  onClose,
  onDone
}: {
  open: boolean
  profile: ProfileListItem | null
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const toast = useToast()
  const [baseName, setBaseName] = useState('')
  const [count, setCount] = useState(1)
  const [department, setDepartment] = useState<Department>(1)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<CopyResultItem[]>([])
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (open && profile) {
      setBaseName(profile.name)
      setCount(1)
      setDepartment(1)
      setProgress([])
      setFinished(false)
      setRunning(false)
    }
  }, [open, profile])

  // подписка на прогресс из main
  useEffect(() => {
    if (!open) return
    const off = window.api.onCopyProgress((item) => {
      setProgress((prev) => {
        const next = [...prev]
        next[item.index] = item
        return next
      })
    })
    return off
  }, [open])

  const run = async (): Promise<void> => {
    if (!profile) return
    if (!baseName.trim()) return toast('error', 'Укажите имя профиля')
    setRunning(true)
    setFinished(false)
    setProgress([])
    try {
      const res = await window.api.copyProfile({
        sourceId: profile.id,
        baseName: baseName.trim(),
        count,
        department
      })
      setProgress(res.items)
      setFinished(true)
      const okCount = res.items.filter((i) => i.ok).length
      if (res.stoppedProxyExhausted) {
        toast('error', `Прокси закончились. Создано: ${okCount} из ${count}.`)
      } else if (okCount === count) {
        toast('success', `Готово: создано ${okCount} ${okCount === 1 ? 'копия' : 'копий'}.`)
      } else {
        toast('error', `Создано ${okCount} из ${count} — часть с ошибками.`)
      }
      if (okCount > 0) onDone()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={running ? () => {} : onClose}
      title={`Копировать: ${profile?.name ?? ''}`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {finished ? 'Закрыть' : 'Отмена'}
          </Button>
          <Button variant="primary" onClick={run} loading={running} disabled={running}>
            Копировать
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Новое имя">
          <Input
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="Имя профиля"
            disabled={running}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            К имени добавляется индекс: {baseName || 'имя'} 1{count > 1 && `, ${baseName || 'имя'} 2…`}
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Количество копий" hint="до 8">
            <Segmented value={count} onChange={(v) => setCount(v)} options={COUNT_OPTIONS} />
          </Field>
          <Field label="Регион">
            <Segmented value={department} onChange={(v) => setDepartment(v)} options={REGION_OPTIONS} />
          </Field>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
          При копировании: <b className="text-slate-300">1)</b> профиль клонируется (куки/вкладки),{' '}
          <b className="text-slate-300">2)</b> применяются «Базовые настройки профиля» + прокси региона.
        </div>

        {(running || progress.length > 0) && (
          <div className="space-y-1.5">
            {Array.from({ length: count }).map((_, i) => {
              const item = progress[i]
              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">
                      {item?.name ?? (count > 1 ? `${baseName} (${i + 1})` : baseName)}
                    </span>
                    {!item && running && <Spinner />}
                    {item?.ok && (
                      <Badge color="green">
                        ✓ {item.proxy?.host}:{item.proxy?.port}
                      </Badge>
                    )}
                    {item && !item.ok && (
                      <Badge color="rose">
                        {item.errorCode === 'proxy_exhausted' ? 'Прокси закончились' : 'Ошибка'}
                      </Badge>
                    )}
                  </div>
                  {item && !item.ok && item.errorMessage && (
                    <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-rose-300/80">
                      {item.errorMessage}
                      <span className="ml-1 text-slate-500">
                        (подробности — во вкладке «Отладка»)
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
