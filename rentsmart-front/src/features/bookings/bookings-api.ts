import { http } from '../../lib/http'
import type { Booking, CancelBookingPayload } from './types'

/** Cancela una reserva propia o de un espacio propio (RE-05). Devuelve la reserva ya cancelada. */
export const cancelBooking = (bookingId: string, reason: string) =>
  http.post<Booking>(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason } satisfies CancelBookingPayload)
