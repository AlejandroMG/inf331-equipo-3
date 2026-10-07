/** Topes que acepta la API (BU-03); un valor fuera de rango en la URL se ignora en vez de provocar un 400. */
export const MAX_SEARCH_LENGTH = 100
const MAX_ID = 2_147_483_647
const MAX_CAPACITY = 1000
const MAX_PRICE = 10_000_000

/** A qué precio se aplica el rango: el de la hora o el del día. */
export type PriceUnit = 'hour' | 'day'

/** Cómo se ordena la lista (BU-04): los más recientes primero, o por precio de menor a mayor o de mayor a menor. */
export type CatalogSort = 'recent' | 'price_asc' | 'price_desc'
const SORTS: readonly CatalogSort[] = ['recent', 'price_asc', 'price_desc']

/**
 * Los filtros del catálogo y su orden. `null` es "sin filtro". Los precios son CLP y se miden en `priceUnit`, que
 * también es el precio por el que ordenan `price_asc` y `price_desc`.
 */
export interface CatalogFilters {
  q: string
  typeId: number | null
  communeId: number | null
  minCapacity: number | null
  priceUnit: PriceUnit
  minPrice: number | null
  maxPrice: number | null
  sort: CatalogSort
}

export const noFilters: CatalogFilters = {
  q: '',
  typeId: null,
  communeId: null,
  minCapacity: null,
  priceUnit: 'hour',
  minPrice: null,
  maxPrice: null,
  sort: 'recent',
}

/** Un entero entre 1 y `max`, escrito en la URL; cualquier otra cosa es "sin filtro". */
function boundedInt(value: string | null, max: number): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null
}

/** Lee los filtros de la URL. Lo que no se entiende se ignora: un enlace viejo o mal escrito igual abre el catálogo. */
export function parseFilters(params: URLSearchParams): CatalogFilters {
  const maxPrice = boundedInt(params.get('maxPrice'), MAX_PRICE)
  let minPrice = boundedInt(params.get('minPrice'), MAX_PRICE)
  // Un mínimo mayor que el máximo no tiene sentido y la API lo rechaza: se descarta el mínimo.
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) minPrice = null

  return {
    q: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    typeId: boundedInt(params.get('typeId'), MAX_ID),
    communeId: boundedInt(params.get('communeId'), MAX_ID),
    minCapacity: boundedInt(params.get('minCapacity'), MAX_CAPACITY),
    priceUnit: params.get('priceUnit') === 'day' ? 'day' : 'hour',
    minPrice,
    maxPrice,
    // Un orden que no se conoce se ignora, como cualquier otro valor inválido.
    sort: SORTS.find((sort) => sort === params.get('sort')) ?? 'recent',
  }
}

/** Si hay algo filtrando. La unidad del precio y el orden no filtran nada: no cuentan como filtros. */
export function hasFilters(filters: CatalogFilters): boolean {
  return (
    filters.q !== '' ||
    filters.typeId !== null ||
    filters.communeId !== null ||
    filters.minCapacity !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null
  )
}

/**
 * La URL de una búsqueda: solo los filtros con valor, el orden si no es el normal y, desde la segunda, la página.
 * Sirve para compartirla.
 * La unidad se escribe cuando es "por día" (por hora es lo normal), aunque todavía no haya precios, para que el
 * selector se quede donde la persona lo dejó.
 */
export function toSearchParams(filters: CatalogFilters, page = 1): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q !== '') params.set('q', filters.q)
  if (filters.typeId !== null) params.set('typeId', String(filters.typeId))
  if (filters.communeId !== null) params.set('communeId', String(filters.communeId))
  if (filters.minCapacity !== null) params.set('minCapacity', String(filters.minCapacity))
  if (filters.priceUnit === 'day') params.set('priceUnit', 'day')
  if (filters.minPrice !== null) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== null) params.set('maxPrice', String(filters.maxPrice))
  if (filters.sort !== 'recent') params.set('sort', filters.sort)
  if (page > 1) params.set('page', String(page))
  return params
}
