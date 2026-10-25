import { http } from '../../lib/http'
import type { Availability, Booking, CancelBookingPayload } from './types'

/**
 * Bloques libres de un espacio publicado entre dos días de Chile, `AAAA-MM-DD`, ambos incluidos y hasta 31 (DI-02).
 * Es pública. Para reservar se mandan tal cual el `startAt` y el `endAt` que trae, sin convertir zonas.
 */
export const getAvailability = (spaceId: string, from: string, to: string, signal?: AbortSignal) =>
  http.get<Availability>(`/spaces/${encodeURIComponent(spaceId)}/availability`, { params: { from, to }, signal })

/** Cancela una reserva propia o de un espacio propio (RE-05). Devuelve la reserva ya cancelada. */
export const cancelBooking = (bookingId: string, reason: string) =>
  http.post<Booking>(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason } satisfies CancelBookingPayload)
