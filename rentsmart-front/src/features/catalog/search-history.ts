import { formatClp } from '../../lib/format'
import { hasFilters, noFilters, parseFilters, toSearchParams, type CatalogFilters } from './filters'

/**
 * Historial de búsquedas recientes (BU-07). Vive en este navegador (`localStorage`): no hay cuenta ni servidor de
 * por medio, así que no cruza dispositivos. Una búsqueda se guarda como la URL de sus filtros, sin la página ni el
 * orden: el orden se elige sobre los resultados y no cambia de qué búsqueda se trata.
 */
export const HISTORY_KEY = 'rentsmart_recent_searches'
export const MAX_RECENT_SEARCHES = 6
/** Cuánto tiempo debe quedar una búsqueda en pantalla para guardarse: así no se guarda cada paso de armarla. */
export const SAVE_AFTER_MS = 3000

const MAX_PARAMS_LENGTH = 500

export interface RecentSearch {
  /** Los parámetros de la URL de la búsqueda (`q=cocina&communeId=2`), sin el signo `?`. */
  params: string
  savedAt: number
}

/** La clave de una búsqueda: sus filtros sin el orden ni la página. Dos búsquedas iguales dan la misma clave. */
export function searchKey(filters: CatalogFilters): string {
  return toSearchParams({ ...filters, sort: noFilters.sort }).toString()
}

/** Lo que quedó guardado, ya validado: lo que no se entiende se descarta en vez de romper el catálogo. */
export function readHistory(): RecentSearch[] {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const entries: RecentSearch[] = []
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const { params, savedAt } = item as Partial<RecentSearch>
    if (typeof params !== 'string' || params.length > MAX_PARAMS_LENGTH || typeof savedAt !== 'number') continue
    const filters = parseFilters(new URLSearchParams(params))
    if (!hasFilters(filters)) continue
    // Se vuelve a escribir desde los filtros: una URL a mano o vieja queda normalizada y sin repetirse.
    const key = searchKey(filters)
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ params: key, savedAt })
  }
  return entries.slice(0, MAX_RECENT_SEARCHES)
}

function write(entries: RecentSearch[]): RecentSearch[] {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // Sin almacenamiento (modo privado, datos bloqueados) el historial dura lo que dura la pantalla.
  }
  return entries
}

/** Guarda una búsqueda al principio de la lista, sin repetirla y sin pasar del máximo. Sin filtros no guarda nada. */
export function saveSearch(filters: CatalogFilters, now = Date.now()): RecentSearch[] {
  const current = readHistory()
  if (!hasFilters(filters)) return current
  const key = searchKey(filters)
  return write([{ params: key, savedAt: now }, ...current.filter((entry) => entry.params !== key)].slice(0, MAX_RECENT_SEARCHES))
}

export function clearHistory(): RecentSearch[] {
  return write([])
}

interface NamedOption {
  id: number
  name: string
}

/** La búsqueda dicha en palabras para el botón: `“cocina” · Providencia · hasta $20.000 por hora`. */
export function describeSearch(filters: CatalogFilters, options?: { types: NamedOption[]; communes: NamedOption[] }): string {
  const parts: string[] = []
  if (filters.q !== '') parts.push(`“${filters.q}”`)
  const type = options?.types.find((t) => t.id === filters.typeId)
  if (type) parts.push(type.name)
  const commune = options?.communes.find((c) => c.id === filters.communeId)
  if (commune) parts.push(commune.name)
  if (filters.minCapacity !== null) parts.push(`${filters.minCapacity} personas o más`)

  const unit = filters.priceUnit === 'day' ? 'por día' : 'por hora'
  if (filters.minPrice !== null && filters.maxPrice !== null) parts.push(`${formatClp(filters.minPrice)} a ${formatClp(filters.maxPrice)} ${unit}`)
  else if (filters.minPrice !== null) parts.push(`desde ${formatClp(filters.minPrice)} ${unit}`)
  else if (filters.maxPrice !== null) parts.push(`hasta ${formatClp(filters.maxPrice)} ${unit}`)

  return parts.join(' · ') || 'Búsqueda guardada'
}
