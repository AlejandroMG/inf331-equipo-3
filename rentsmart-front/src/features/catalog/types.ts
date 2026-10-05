/** Espacio tal como lo muestra el catálogo (GET /api/catalog). Nunca incluye la dirección privada. */
export interface CatalogItem {
  id: string
  name: string
  typeName: string
  communeName: string
  capacity: number
  /** CLP enteros; null si el espacio no se arrienda por hora. */
  pricePerHour: number | null
  /** CLP enteros; null si el espacio no se arrienda por día. */
  pricePerDay: number | null
  /** Foto de portada; null si todavía no tiene. */
  coverUrl: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type CatalogPageData = Paginated<CatalogItem>
