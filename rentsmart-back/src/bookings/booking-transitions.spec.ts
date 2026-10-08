import { BookingStatus } from '../generated/prisma/enums';
import { BOOKING_TRANSITIONS, canTransition, isFinalStatus } from './booking-transitions';

const STATUSES = Object.values(BookingStatus);
const VALID = new Set([
  'PENDING>PAID',
  'PENDING>EXPIRED',
  'PENDING>CANCELLED',
  'PAID>CONFIRMED',
  'PAID>CANCELLED',
  'CONFIRMED>FINISHED',
  'CONFIRMED>CANCELLED',
]);
const PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to, VALID.has(`${from}>${to}`)] as const));

describe('Transiciones de la reserva', () => {
  it('la tabla cubre los 6 estados y tiene exactamente 7 transiciones', () => {
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual([...STATUSES].sort());
    expect(Object.values(BOOKING_TRANSITIONS).flat()).toHaveLength(7);
    expect(PAIRS).toHaveLength(36);
  });

  it.each(PAIRS)('%s → %s: válida = %s', (from, to, valid) => {
    expect(canTransition(from, to)).toBe(valid);
  });

  it.each([
    ['PENDING', false],
    ['PAID', false],
    ['CONFIRMED', false],
    ['FINISHED', true],
    ['CANCELLED', true],
    ['EXPIRED', true],
  ] as const)('%s es final: %s', (status, final) => {
    expect(isFinalStatus(status)).toBe(final);
  });
});
