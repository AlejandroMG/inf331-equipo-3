import { useEffect, useRef, useState } from 'react'

interface Result<T> {
  /** Identifica la petición a la que pertenece este resultado. */
  request: string
  data?: T
  error?: Error
}

/**
 * Carga datos al montar y cada vez que cambia `key` (por ejemplo la página o el id). Mientras la petición
 * vigente no tenga resultado, `loading` es true: así no se muestra el dato anterior bajo una clave nueva,
 * y no hace falta cambiar estado de forma síncrona dentro del efecto. La petición se cancela al cambiar
 * de clave o al desmontar.
 */
export function useRequest<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const request = `${key}:${attempt}`

  // `load` es una función nueva en cada render; se guarda la última para no repetir la petición por eso.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    const controller = new AbortController()
    loadRef
      .current(controller.signal)
      .then((data) => setResult({ request, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({ request, error: error instanceof Error ? error : new Error(String(error)) })
      })
    return () => controller.abort()
  }, [request])

  const current = result?.request === request ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: current === null,
    /** Repite la petición actual (botón "Reintentar"). */
    retry: () => setAttempt((n) => n + 1),
  }
}
