import type { MissingField } from '../spaces/form'
import type { OwnerSpace } from '../spaces/types'

/** Un espacio en el panel del propietario (GET /api/spaces/me). Nunca incluye la dirección privada. */
export interface OwnerSpaceSummary {
  id: string
  status: OwnerSpace['status']
  name: string
  typeName: string | null
  communeName: string | null
  /** CLP enteros; null si el espacio no se arrienda por hora. */
  pricePerHour: number | null
  /** CLP enteros; null si el espacio no se arrienda por día. */
  pricePerDay: number | null
  /** Foto de portada; null si todavía no tiene. */
  coverUrl: string | null
  /** Lo que falta para publicarlo o mantenerlo publicado; vacío si está completo. */
  missing: MissingField[]
  updatedAt: string
}
