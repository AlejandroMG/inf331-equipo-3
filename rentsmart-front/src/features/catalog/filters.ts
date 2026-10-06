/** Topes que acepta la API (BU-03); un valor fuera de rango en la URL se ignora en vez de provocar un 400. */
export const MAX_SEARCH_LENGTH = 100
const MAX_ID = 2_147_483_647
const MAX_CAPACITY = 1000
const MAX_PRICE = 10_000_000

/** Los filtros del catálogo. `null` es "sin filtro". El precio es el máximo por hora, en CLP. */
export interface CatalogFilters {
  q: string
  typeId: number | null
  communeId: number | null
  minCapacity: number | null
  maxPrice: number | null
}

export const noFilters: CatalogFilters = { q: '', typeId: null, communeId: null, minCapacity: null, maxPrice: null }

/** Un entero entre 1 y `max`, escrito en la URL; cualquier otra cosa es "sin filtro". */
function boundedInt(value: string | null, max: number): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null
}

/** Lee los filtros de la URL. Lo que no se entiende se ignora: un enlace viejo o mal escrito igual abre el catálogo. */
export function parseFilters(params: URLSearchParams): CatalogFilters {
  return {
    q: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    typeId: boundedInt(params.get('typeId'), MAX_ID),
    communeId: boundedInt(params.get('communeId'), MAX_ID),
    minCapacity: boundedInt(params.get('minCapacity'), MAX_CAPACITY),
    maxPrice: boundedInt(params.get('maxPrice'), MAX_PRICE),
  }
}

export function hasFilters(filters: CatalogFilters): boolean {
  return (Object.keys(noFilters) as Array<keyof CatalogFilters>).some((key) => filters[key] !== noFilters[key])
}

/** La URL de una búsqueda: solo los filtros con valor y, desde la segunda, la página. Sirve para compartirla. */
export function toSearchParams(filters: CatalogFilters, page = 1): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q !== '') params.set('q', filters.q)
  if (filters.typeId !== null) params.set('typeId', String(filters.typeId))
  if (filters.communeId !== null) params.set('communeId', String(filters.communeId))
  if (filters.minCapacity !== null) params.set('minCapacity', String(filters.minCapacity))
  if (filters.maxPrice !== null) params.set('maxPrice', String(filters.maxPrice))
  if (page > 1) params.set('page', String(page))
  return params
}
