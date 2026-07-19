import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

export interface Option {
  value: string
  label: string
}

/** Компактный мультивыбор с выпадающим списком чекбоксов. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Все'
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (v: string): void => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }

  const summary =
    selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} выбрано`

  return (
    <div className="relative" ref={ref}>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm',
          selected.length ? 'text-slate-100' : 'text-slate-500'
        )}
      >
        <span className="truncate">{summary}</span>
        <span className="ml-2 text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">Нет значений</div>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-indigo-500"
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-800"
            >
              Сбросить
            </button>
          )}
        </div>
      )}
    </div>
  )
}
