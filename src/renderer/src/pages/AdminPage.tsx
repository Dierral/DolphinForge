import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry } from '@shared/types'
import { Card, Input, Button, Field, Segmented, Badge } from '../components/ui'
import { useToast } from '../components/toast'
import { cn } from '../lib/cn'

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  debug: 'text-slate-500',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-300'
}

export function AdminPage(): JSX.Element {
  const [authed, setAuthed] = useState(false)
  if (!authed) return <LoginGate onOk={() => setAuthed(true)} />
  return <DebugConsole />
}

// ── Логин ─────────────────────────────────────────────────────────────────────
function LoginGate({ onOk }: { onOk: () => void }): JSX.Element {
  const toast = useToast()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      const ok = await window.api.adminLogin(login.trim(), password)
      if (ok) onOk()
      else toast('error', 'Неверный логин или пароль')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-1 text-center text-lg font-semibold text-slate-100">Админ-панель</div>
        <p className="mb-5 text-center text-xs text-slate-500">Полная отладка действий приложения</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="space-y-4"
        >
          <Field label="Логин">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
          </Field>
          <Field label="Пароль">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            Войти
          </Button>
        </form>
      </Card>
    </div>
  )
}

// ── Консоль логов ───────────────────────────────────────────────────────────
function DebugConsole(): JSX.Element {
  const toast = useToast()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [level, setLevel] = useState<'all' | LogEntry['level']>('all')
  const [q, setQ] = useState('')
  const [autoscroll, setAutoscroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // начальная загрузка + подписка на новые
  useEffect(() => {
    window.api.getLogs().then(setLogs).catch(() => {})
    const off = window.api.onLog((entry) => setLogs((prev) => [...prev.slice(-2999), entry]))
    return off
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return logs.filter((l) => {
      if (level !== 'all' && l.level !== level) return false
      if (needle) {
        const hay = `${l.scope} ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [logs, level, q])

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filtered, autoscroll])

  const clear = async (): Promise<void> => {
    await window.api.clearLogs()
    setLogs([])
  }

  const copyAll = async (): Promise<void> => {
    const text = filtered
      .map(
        (l) =>
          `[${l.ts}] ${l.level.toUpperCase()} (${l.scope}) ${l.message}${
            l.data ? ' ' + JSON.stringify(l.data) : ''
          }`
      )
      .join('\n')
    await navigator.clipboard.writeText(text)
    toast('success', `Скопировано строк: ${filtered.length}`)
  }

  const errorCount = logs.filter((l) => l.level === 'error').length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Отладка</h2>
          <p className="text-xs text-slate-500">
            Живой лог всех действий · всего {logs.length}
            {errorCount > 0 && <span className="text-rose-400"> · ошибок {errorCount}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyAll}>
            Скопировать
          </Button>
          <Button variant="danger" onClick={clear}>
            Очистить
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/40 px-6 py-3">
        <Segmented
          value={level}
          onChange={setLevel}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Warn' },
            { value: 'error', label: 'Error' },
            { value: 'debug', label: 'Debug' }
          ]}
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Фильтр по тексту…"
          className="max-w-xs"
        />
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={autoscroll}
            onChange={(e) => setAutoscroll(e.target.checked)}
            className="accent-indigo-500"
          />
          Автопрокрутка
        </label>
      </div>

      <div className="flex-1 overflow-auto bg-slate-950 px-6 py-3 font-mono text-xs leading-relaxed">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-600">Пока пусто — выполните действие</div>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="border-b border-slate-900 py-1">
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-slate-600">{l.ts.slice(11, 19)}</span>
                <span className={cn('w-12 shrink-0 font-semibold uppercase', LEVEL_COLOR[l.level])}>
                  {l.level}
                </span>
                <Badge>{l.scope}</Badge>
                <span className="whitespace-pre-wrap break-all text-slate-200">{l.message}</span>
              </div>
              {l.data !== undefined && l.data !== null && (
                <pre className="ml-16 mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-500">
                  {JSON.stringify(l.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
