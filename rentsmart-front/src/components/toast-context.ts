import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error'

export interface ToastApi {
  /** Muestra un aviso que se cierra solo a los 5 segundos. */
  show: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
