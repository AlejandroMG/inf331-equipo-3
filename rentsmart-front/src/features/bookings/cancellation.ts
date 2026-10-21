import type { BookingStatus } from './types'

/** Largo del motivo, igual que en el back (`CancelBookingDto`). */
export const MIN_CANCEL_REASON = 5
export const MAX_CANCEL_REASON = 500
/** Hasta cuántas horas antes del inicio el arrendatario cancela gratis (P-14). */
export const FREE_CANCELLATION_HOURS = 24

export type CancelledBy = 'RENTER' | 'OWNER'

/** Lo que el diálogo necesita saber de la reserva; sirve la del arrendatario y la del panel del propietario. */
export interface CancellableBooking {
  id: string
  status: BookingStatus
  /** UTC (ISO 8601). */
  startAt: string
}

/** Los estados desde los que una persona puede cancelar. */
export const canCancel = (status: BookingStatus) => status === 'PENDING' || status === 'CONFIRMED'

/**
 * Si cancelar ahora reembolsa el total (P-14), la misma regla que `cancellationRefund` del back: solo una
 * reserva confirmada tiene algo que devolver; si cancela el propietario, siempre; si cancela el arrendatario,
 * hasta 24 horas antes del inicio (inclusive).
 */
export function refundsOnCancel(booking: Pick<CancellableBooking, 'status' | 'startAt'>, cancelledBy: CancelledBy, now: Date): boolean {
  if (booking.status !== 'CONFIRMED') return false
  if (cancelledBy === 'OWNER') return true
  return new Date(booking.startAt).getTime() - now.getTime() >= FREE_CANCELLATION_HOURS * 3_600_000
}

/** Por qué el motivo no vale, o null si vale. Los espacios de los extremos no cuentan. */
export function reasonError(reason: string): string | null {
  const length = reason.trim().length
  if (length === 0) return 'Escribe el motivo de la cancelación.'
  if (length < MIN_CANCEL_REASON) return `El motivo debe tener al menos ${MIN_CANCEL_REASON} caracteres.`
  if (length > MAX_CANCEL_REASON) return `El motivo no puede superar los ${MAX_CANCEL_REASON} caracteres.`
  return null
}
