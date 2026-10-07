import { http } from '../../lib/http'
import type { BookingStatus, OwnerBookingsPage, OwnerMetrics, OwnerSpaceSummary } from './types'

/** Los espacios del usuario, de cualquier estado, los modificados más recientemente primero. */
export const fetchMySpaces = (signal?: AbortSignal) => http.get<OwnerSpaceSummary[]>('/spaces/me', { signal })

export const BOOKINGS_PAGE_SIZE = 20

export interface BookingFilters {
  status: BookingStatus | null
  /** Día `AAAA-MM-DD` (hora de Chile) desde el que empiezan las reservas. */
  from: string
  to: string
  sort: 'asc' | 'desc'
}

/** Una página de las reservas de mis espacios. El cliente HTTP omite los filtros vacíos. */
export function fetchOwnerBookings({
  page = 1,
  pageSize = BOOKINGS_PAGE_SIZE,
  filters,
  signal,
}: {
  page?: number
  pageSize?: number
  filters: BookingFilters
  signal?: AbortSignal
}) {
  return http.get<OwnerBookingsPage>('/owner/bookings', {
    params: { page, pageSize, status: filters.status, from: filters.from, to: filters.to, sort: filters.sort },
    signal,
  })
}

/** Ingresos y ocupación de un mes (`AAAA-MM`); sin mes, el actual. */
export const fetchOwnerMetrics = (month?: string, signal?: AbortSignal) =>
  http.get<OwnerMetrics>('/owner/metrics', { params: { month }, signal })
