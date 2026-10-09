import { BookingStatus } from '../generated/prisma/enums';

/**
 * Transiciones válidas de una reserva (RE-01, P-05 y P-06), como datos: desde cada estado, a cuáles puede pasar.
 * No depende de Nest ni de la base; `BookingStateService.transition` es quien las aplica.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  PENDING: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** Un estado final no tiene salida: `FINISHED`, `CANCELLED` y `EXPIRED`. */
export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}
