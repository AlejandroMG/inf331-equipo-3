import { BookingStatus } from '../generated/prisma/enums';
import { cancellationRefund, FREE_CANCELLATION_HOURS } from './cancellation-policy';

const START = new Date('2026-10-20T15:00:00.000Z');
const TOTAL = 26400;
const MINUTE = 60_000;
const before = (ms: number) => new Date(START.getTime() - ms);
const booking = (status: BookingStatus = 'CONFIRMED') => ({ status, startAt: START, total: TOTAL });

describe('cancellationRefund (P-14)', () => {
  it('la cancelación gratis es hasta 24 horas antes', () => {
    expect(FREE_CANCELLATION_HOURS).toBe(24);
  });

  describe('cancela el arrendatario', () => {
    it.each([
      ['una semana antes', 7 * 24 * 60 * MINUTE, TOTAL],
      ['24 horas y un minuto antes', 24 * 60 * MINUTE + MINUTE, TOTAL],
      ['exactamente 24 horas antes', 24 * 60 * MINUTE, TOTAL],
      ['un milisegundo menos de 24 horas antes', 24 * 60 * MINUTE - 1, 0],
      ['23 horas y 59 minutos antes', 24 * 60 * MINUTE - MINUTE, 0],
      ['una hora antes', 60 * MINUTE, 0],
      ['justo al inicio', 0, 0],
      ['con la reserva ya empezada', -30 * MINUTE, 0],
    ])('%s', (_name, ms, expected) => {
      expect(cancellationRefund(booking(), 'RENTER', before(ms))).toBe(expected);
    });
  });

  describe('cancela el propietario', () => {
    it.each([
      ['una semana antes', 7 * 24 * 60 * MINUTE],
      ['exactamente 24 horas antes', 24 * 60 * MINUTE],
      ['un minuto menos de 24 horas antes', 24 * 60 * MINUTE - MINUTE],
      ['un minuto antes', MINUTE],
      ['con la reserva ya empezada', -30 * MINUTE],
    ])('%s reembolsa el total', (_name, ms) => {
      expect(cancellationRefund(booking(), 'OWNER', before(ms))).toBe(TOTAL);
    });
  });

  it('el reembolso total incluye la comisión', () => {
    const paid = { status: BookingStatus.CONFIRMED, startAt: START, total: 24000 + 2400 };

    expect(cancellationRefund(paid, 'RENTER', before(48 * 60 * MINUTE))).toBe(26400);
  });

  it.each(['PENDING', 'PAID', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const)(
    'una reserva %s no tiene nada que reembolsar, cancele quien cancele',
    (status) => {
      const early = before(7 * 24 * 60 * MINUTE);

      expect(cancellationRefund(booking(status), 'RENTER', early)).toBe(0);
      expect(cancellationRefund(booking(status), 'OWNER', early)).toBe(0);
    },
  );
});
