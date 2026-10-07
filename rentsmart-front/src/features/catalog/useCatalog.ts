import { useRequest } from '../../lib/useRequest'
import { fetchCatalog } from './catalog-api'
import { toSearchParams, type CatalogFilters } from './filters'
// Los tipos y las comunas son datos de referencia que ya se leen para publicar; se reutilizan aquí.
import { fetchCommunes, fetchRegions, fetchSpaceTypes } from '../spaces/spaces-api'

/** Carga una página del catálogo con sus filtros; se vuelve a pedir cuando cambia la página o cualquiera de ellos. */
export function useCatalog(page: number, filters: CatalogFilters) {
  return useRequest(toSearchParams(filters, page).toString(), (signal) => fetchCatalog({ page, filters, signal }))
}

async function loadFilterOptions(signal: AbortSignal) {
  const [types, regions] = await Promise.all([fetchSpaceTypes(signal), fetchRegions(signal)])
  // Por ahora solo hay una región (la Metropolitana).
  const region = regions[0]
  const communes = region ? await fetchCommunes(region.id, signal) : []
  return { types, communes }
}

/** Los tipos de espacio y las comunas para armar los filtros. */
export function useFilterOptions() {
  return useRequest('filter-options', loadFilterOptions)
}
