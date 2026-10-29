import { http } from '../../lib/http'
import type { Availability, Booking, BookingCheckout, CancelBookingPayload, CreateBookingPayload } from './types'

/**
 * Bloques libres de un espacio publicado entre dos días de Chile, `AAAA-MM-DD`, ambos incluidos y hasta 31 (DI-02).
 * Es pública. Para reservar se mandan tal cual el `startAt` y el `endAt` que trae, sin convertir zonas.
 */
export const getAvailability = (spaceId: string, from: string, to: string, signal?: AbortSignal) =>
  http.get<Availability>(`/spaces/${encodeURIComponent(spaceId)}/availability`, { params: { from, to }, signal })

/** Cancela una reserva propia o de un espacio propio (RE-05). Devuelve la reserva ya cancelada. */
export const cancelBooking = (bookingId: string, reason: string) =>
  http.post<Booking>(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason } satisfies CancelBookingPayload)

/**
 * Reserva un horario (RE-02). La reserva nace `PENDING` y retiene el horario 30 minutos; hay que redirigir a
 * `checkoutUrl` para pagar. Los montos los calcula el back: aquí no se mandan.
 */
export const createBooking = (payload: CreateBookingPayload) =>
  http.post<BookingCheckout>('/bookings', { spaceId: payload.spaceId, startAt: payload.startAt, endAt: payload.endAt, unit: payload.unit } satisfies CreateBookingPayload)

/** Una reserva propia, con su estado y su desglose (RE-02). 403 si es de otro usuario y 404 si no existe. */
export const getBooking = (bookingId: string, signal?: AbortSignal) =>
  http.get<Booking>(`/bookings/${encodeURIComponent(bookingId)}`, { signal })
