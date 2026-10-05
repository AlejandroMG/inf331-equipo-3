import { http } from '../../lib/http'
import type { CatalogPageData } from './types'

export const CATALOG_PAGE_SIZE = 12

interface FetchCatalogParams {
  page: number
  pageSize?: number
  signal?: AbortSignal
}

export function fetchCatalog({ page, pageSize = CATALOG_PAGE_SIZE, signal }: FetchCatalogParams) {
  return http.get<CatalogPageData>('/catalog', { params: { page, pageSize }, signal })
}
