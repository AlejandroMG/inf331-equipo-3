import { BookingStatus } from '../generated/prisma/enums';

/** Hasta cuántas horas antes del inicio el arrendatario cancela gratis (P-14). */
export const FREE_CANCELLATION_HOURS = 24;

export type CancelledBy = 'RENTER' | 'OWNER';

export interface RefundableBooking {
  status: BookingStatus;
  startAt: Date;
  /** CLP enteros: subtotal más comisión, lo que pagó el arrendatario. */
  total: number;
}

/**
 * Cuánto se reembolsa al cancelar (P-14), en CLP enteros. Una reserva que no llegó a `CONFIRMED` no tiene nada
 * que devolver aquí. Si cancela el propietario, siempre el total. Si cancela el arrendatario, el total hasta
 * 24 horas antes del inicio (inclusive) y nada después. El total incluye la comisión.
 */
export function cancellationRefund(booking: RefundableBooking, cancelledBy: CancelledBy, now: Date): number {
  if (booking.status !== BookingStatus.CONFIRMED) return 0;
  if (cancelledBy === 'OWNER') return booking.total;
  const msBeforeStart = booking.startAt.getTime() - now.getTime();
  return msBeforeStart >= FREE_CANCELLATION_HOURS * 3_600_000 ? booking.total : 0;
}
