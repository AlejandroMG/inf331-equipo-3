import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from '../../components/toast-context'
import { useToken } from '../../lib/token'
import { addFavorite, fetchFavoriteIds, removeFavorite } from './favorites-api'
import { FavoritesContext, type FavoritesApi } from './favorites-context'

const NO_IDS: ReadonlySet<string> = new Set()

/**
 * Los favoritos de la sesión, compartidos por todas las pantallas: el corazón de una tarjeta y el de la lista dicen lo
 * mismo. Se cargan al iniciar sesión y se olvidan al cerrarla. Marcar o desmarcar se ve al instante; si el servidor
 * lo rechaza, se deshace y se avisa.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const token = useToken()
  // Los avisos son opcionales: sin ToastProvider el cambio igual se deshace, solo que en silencio.
  const toast = useContext(ToastContext)
  // Se guarda con el token con el que se cargó: al cambiar de sesión, lo anterior deja de valer sin tener que borrarlo.
  const [loaded, setLoaded] = useState<{ token: string; ids: ReadonlySet<string> } | null>(null)
  const pending = useRef(new Set<string>())

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    fetchFavoriteIds(controller.signal)
      .then((list) => setLoaded({ token, ids: new Set(list) }))
      .catch(() => undefined) // sin la lista, los corazones se ven vacíos; guardar uno sigue funcionando
    return () => controller.abort()
  }, [token])

  const ready = token !== null && loaded?.token === token
  const ids = ready ? loaded.ids : NO_IDS
  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  })

  const toggle = useCallback(
    async (spaceId: string) => {
      if (!token || pending.current.has(spaceId)) return
      const wasFavorite = idsRef.current.has(spaceId)
      const set = (favorite: boolean) =>
        setLoaded((current) => {
          const ids = new Set(current?.token === token ? current.ids : [])
          if (favorite) ids.add(spaceId)
          else ids.delete(spaceId)
          return { token, ids }
        })

      pending.current.add(spaceId)
      set(!wasFavorite)
      try {
        await (wasFavorite ? removeFavorite(spaceId) : addFavorite(spaceId))
      } catch (error) {
        set(wasFavorite)
        toast?.show(error instanceof Error ? error.message : 'No pudimos actualizar tus favoritos. Intenta de nuevo.', 'error')
      } finally {
        pending.current.delete(spaceId)
      }
    },
    [token, toast],
  )

  const value = useMemo<FavoritesApi>(() => ({ ready, isFavorite: (id) => ids.has(id), toggle }), [ready, ids, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
