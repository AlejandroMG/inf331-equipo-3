import { http } from '../../lib/http'
import { noFilters, type CatalogFilters } from './filters'
import type { CatalogPageData, SpaceDetail } from './types'

export const CATALOG_PAGE_SIZE = 12

interface FetchCatalogParams {
  page: number
  pageSize?: number
  filters?: CatalogFilters
  signal?: AbortSignal
}

/** Una página del catálogo. El cliente HTTP omite los filtros vacíos o `null`. */
export function fetchCatalog({ page, pageSize = CATALOG_PAGE_SIZE, filters = noFilters, signal }: FetchCatalogParams) {
  return http.get<CatalogPageData>('/catalog', {
    params: {
      page,
      pageSize,
      q: filters.q,
      typeId: filters.typeId,
      communeId: filters.communeId,
      minCapacity: filters.minCapacity,
      // La unidad solo importa junto con un precio: un rango o un orden por precio. Sin eso no se manda.
      priceUnit:
        filters.minPrice !== null || filters.maxPrice !== null || filters.sort !== 'recent' ? filters.priceUnit : undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      // El orden normal (más recientes) es el de la API: solo se manda si se pidió otro.
      sort: filters.sort === 'recent' ? undefined : filters.sort,
    },
    signal,
  })
}

/** Detalle público de un espacio. Responde 404 si no existe o no está activo. */
export function fetchSpace(id: string, signal?: AbortSignal) {
  return http.get<SpaceDetail>(`/catalog/${encodeURIComponent(id)}`, { signal })
}
