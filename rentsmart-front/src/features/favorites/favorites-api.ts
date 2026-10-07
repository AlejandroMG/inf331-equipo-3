import { http } from '../../lib/http'
import type { CatalogPageData } from '../catalog/types'

export const FAVORITES_PAGE_SIZE = 12

/** Los ids de mis favoritos activos, para marcar el corazón en el catálogo. Requiere sesión. */
export function fetchFavoriteIds(signal?: AbortSignal) {
  return http.get<string[]>('/favorites/ids', { signal })
}

/** Mis favoritos activos como tarjetas del catálogo, el último guardado primero. */
export function fetchFavorites(page: number, signal?: AbortSignal) {
  return http.get<CatalogPageData>('/favorites', { params: { page, pageSize: FAVORITES_PAGE_SIZE }, signal })
}

/** Guarda un espacio como favorito. Es idempotente; responde 404 si no existe o no está activo. */
export function addFavorite(spaceId: string) {
  return http.put<void>(`/favorites/${encodeURIComponent(spaceId)}`)
}

/** Quita un espacio de mis favoritos. Es idempotente. */
export function removeFavorite(spaceId: string) {
  return http.delete<void>(`/favorites/${encodeURIComponent(spaceId)}`)
}
