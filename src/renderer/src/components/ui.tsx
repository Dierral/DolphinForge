import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, useEffect, useId } from 'react'
import { cn } from '../lib/cn'

// ── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger'
export function Button({
  variant = 'outline',
  className,
  children,
  loading,
  disabled,
  ...rest
}: {
  variant?: BtnVariant
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:pointer-events-none select-none'
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-indigo-500 active:scale-[.98]',
    outline: 'border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800/60',
    ghost: 'text-slate-300 hover:bg-slate-800/60',
    danger: 'bg-rose-600/90 text-white hover:bg-rose-500 active:scale-[.98]'
  }
  return (
    <button className={cn(base, variants[variant], className)} disabled={loading || disabled} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

// ── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white',
        className
      )}
    />
  )
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }): JSX.Element {
  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm', className)}>
      {children}
    </div>
  )
}

// ── Input ───────────────────────────────────────────────────────────────────
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500',
        'outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
        className
      )}
      {...rest}
    />
  )
}

// ── Combo (ввод + выбор из существующих вариантов, как manual в Dolphin) ──────
export function Combo({
  value,
  onChange,
  options,
  placeholder,
  className
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
}): JSX.Element {
  const id = useId()
  return (
    <>
      <Input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

// ── Select ──────────────────────────────────────────────────────────────────
export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100',
        'outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

// ── Field (label + control) ──────────────────────────────────────────────────
export function Field({
  label,
  hint,
  children,
  className
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <label className={cn('block', className)}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

// ── Toggle ──────────────────────────────────────────────────────────────────
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-indigo-500' : 'bg-slate-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
      {label && <span className="text-sm text-slate-200">{label}</span>}
    </button>
  )
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({
  children,
  color = 'slate'
}: {
  children: ReactNode
  color?: 'slate' | 'indigo' | 'green' | 'amber' | 'rose'
}): JSX.Element {
  const colors: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        colors[color]
      )}
    >
      {children}
    </span>
  )
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg'
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <Card className={cn('relative z-10 w-full', width)}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">{footer}</div>
        )}
      </Card>
    </div>
  )
}

// ── Segmented (переключатель режимов) ────────────────────────────────────────
export function Segmented<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/60 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === o.value ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
