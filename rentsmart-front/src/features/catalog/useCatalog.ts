import { useEffect, useState } from 'react'
import { fetchCatalog } from './catalog-api'
import type { CatalogPageData } from './types'

interface Result {
  /** Identifica la petición a la que pertenece este resultado. */
  request: string
  data?: CatalogPageData
  error?: Error
}

/**
 * Carga una página del catálogo. Mientras la petición vigente no tenga resultado, `loading` es true:
 * así no se muestra la página anterior bajo un número de página nuevo, y no hace falta cambiar estado
 * de forma síncrona dentro del efecto.
 */
export function useCatalog(page: number) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const request = `${page}:${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalog({ page, signal: controller.signal })
      .then((data) => setResult({ request, data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({ request, error: error instanceof Error ? error : new Error(String(error)) })
      })
    return () => controller.abort()
  }, [page, request])

  const current = result?.request === request ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: current === null,
    /** Repite la petición de la página actual (botón "Reintentar"). */
    retry: () => setAttempt((n) => n + 1),
  }
}
