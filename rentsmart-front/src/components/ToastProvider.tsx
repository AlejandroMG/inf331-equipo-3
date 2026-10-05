import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { AlertIcon, CheckIcon, CloseIcon } from './icons'
import { ToastContext, type ToastApi, type ToastType } from './toast-context'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const DURATION_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback<ToastApi['show']>(
    (message, type = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, type }])
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION_MS))
    },
    [dismiss],
  )

  // Al desmontar el proveedor no deben quedar temporizadores pendientes.
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold shadow-lg',
              toast.type === 'error'
                ? 'border border-accent bg-accent-soft text-accent-ink'
                : 'bg-primary-dark text-white',
            )}
          >
            {toast.type === 'error' ? <AlertIcon className="shrink-0" /> : <CheckIcon className="shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Cerrar aviso"
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/10"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
