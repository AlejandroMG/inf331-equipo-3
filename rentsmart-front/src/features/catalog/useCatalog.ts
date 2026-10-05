import { useRequest } from '../../lib/useRequest'
import { fetchCatalog } from './catalog-api'

/** Carga una página del catálogo. */
export function useCatalog(page: number) {
  return useRequest(String(page), (signal) => fetchCatalog({ page, signal }))
}
