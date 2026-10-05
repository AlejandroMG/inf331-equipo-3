import { http } from '../../lib/http'
import type { CatalogPageData, SpaceDetail } from './types'

export const CATALOG_PAGE_SIZE = 12

interface FetchCatalogParams {
  page: number
  pageSize?: number
  signal?: AbortSignal
}

export function fetchCatalog({ page, pageSize = CATALOG_PAGE_SIZE, signal }: FetchCatalogParams) {
  return http.get<CatalogPageData>('/catalog', { params: { page, pageSize }, signal })
}

/** Detalle público de un espacio. Responde 404 si no existe o no está activo. */
export function fetchSpace(id: string, signal?: AbortSignal) {
  return http.get<SpaceDetail>(`/catalog/${encodeURIComponent(id)}`, { signal })
}
