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
  /** Por qué un administrador bloqueó el espacio; null si no está bloqueado. */
  blockedReason: string | null
  updatedAt: string
}

/** Estados de una reserva (los mismos que el back). */
export type BookingStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED' | 'EXPIRED'

/** Una reserva de uno de mis espacios (GET /api/owner/bookings). */
export interface OwnerBooking {
  id: string
  spaceId: string
  spaceName: string
  renterName: string
  /** UTC (ISO 8601); se muestra en la hora de Chile. */
  startAt: string
  endAt: string
  unit: 'HOUR' | 'DAY'
  /** CLP enteros: lo que recibe el propietario, sin la comisión de la plataforma. */
  subtotal: number
  status: BookingStatus
  /** Cómo contactar al arrendatario: solo en las reservas confirmadas. */
  contact: { email: string; phone: string | null } | null
}

export interface OwnerBookingsPage {
  items: OwnerBooking[]
  total: number
  page: number
  pageSize: number
}

/** Ingresos y ocupación de un espacio en un mes (GET /api/owner/metrics). */
export interface SpaceMetrics {
  id: string
  name: string
  status: OwnerSpace['status']
  income: number
  bookings: number
  bookedHours: number
  availableHours: number
  /** De 0 a 1; null si el espacio no tiene horario cargado. */
  occupancy: number | null
}

export interface OwnerMetrics {
  /** AAAA-MM, en la hora de Chile. */
  month: string
  income: number
  bookings: number
  spaces: SpaceMetrics[]
}
