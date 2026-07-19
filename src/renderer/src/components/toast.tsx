import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { cn } from '../lib/cn'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const ToastCtx = createContext<(kind: ToastKind, message: string) => void>(() => {})

export function useToast(): (kind: ToastKind, message: string) => void {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const styles: Record<ToastKind, string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    info: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
  }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur',
              styles[t.kind]
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
