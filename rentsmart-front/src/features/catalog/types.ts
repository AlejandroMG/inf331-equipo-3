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

export interface SpacePhoto {
  id: string
  url: string
  /** 0 es la portada. */
  position: number
}

export interface ScheduleRule {
  /** 0 = domingo ... 6 = sábado. */
  weekday: number
  /** "HH:mm" */
  startTime: string
  endTime: string
}

/** Detalle público de un espacio (GET /api/catalog/:id). Nunca incluye `addressDetail`. */
export interface SpaceDetail {
  id: string
  name: string
  description: string | null
  typeName: string
  regionName: string
  communeName: string
  /** Dirección pública. */
  address: string | null
  capacity: number
  pricePerHour: number | null
  pricePerDay: number | null
  rules: string | null
  /** Nombres, por orden alfabético. */
  amenities: string[]
  /** Por posición; la primera es la portada. */
  photos: SpacePhoto[]
  schedule: ScheduleRule[]
}
