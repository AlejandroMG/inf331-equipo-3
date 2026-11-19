import { INestApplication, Logger } from '@nestjs/common';
import { App } from 'supertest/types';
import { SPACE_UNAVAILABLE_REASON, BookingConfirmationService } from '../src/bookings/booking-confirmation.service';
import {
  EXPIRED_REASON,
  FINISHED_REASON,
  STUCK_PAID_AFTER_MS,
  BookingExpiryService,
} from '../src/bookings/booking-expiry.service';
import { BookingStatus } from '../src/generated/prisma/enums';
import { PAYMENT_REFUNDER } from '../src/payments/payment-refunder';
import { PrismaService } from '../src/prisma/prisma.service';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// RE-06: vencimientos automáticos contra la base de test. No tiene endpoints, así que se prueba el servicio.
// El barrido recibe la hora "actual": aquí es una del año 2000, y las reservas de este archivo también, así el
// barrido sin espacio solo alcanza datos de este archivo (los demás e2e usan fechas de ahora en adelante).
const SUFFIX = `e2e-re06-${Date.now()}`;
const HOUR = 3_600_000;
const NOW = new Date('2000-01-10T12:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('Vencimientos automáticos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let expiry: BookingExpiryService;
  let userId: string;
  let spaceId: string;
  let otherSpaceId: string;
  let activeSpaceId: string;
  const refunder = { refundBooking: jest.fn<Promise<void>, [string, number, string]>() };

  const booking = (
    status: BookingStatus,
    startAt: Date,
    extra: { endAt?: Date; expiresAt?: Date | null; space?: string } = {},
  ) =>
    prisma.booking
      .create({
        data: {
          spaceId: extra.space ?? spaceId,
          renterId: userId,
          startAt,
          endAt: extra.endAt ?? new Date(startAt.getTime() + HOUR),
          unit: 'HOUR',
          subtotal: 10000,
          total: 10000,
          status,
          expiresAt: extra.expiresAt ?? null,
        },
      })
      .then((created) => created.id);
  const statusOf = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
  const eventsOf = (bookingId: string) =>
    prisma.bookingEvent.findMany({
      where: { bookingId },
      select: { fromStatus: true, toStatus: true, actorId: true, reason: true },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(PAYMENT_REFUNDER).useValue(refunder));
    prisma = app.get(PrismaService);
    expiry = app.get(BookingExpiryService);
    const user = await prisma.user.create({
      data: { email: `user-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: 'Vencimientos' },
    });
    userId = user.id;
    // Desactivados, para no aparecer en el catálogo que revisan otros e2e.
    spaceId = (await prisma.space.create({ data: { ownerId: userId, name: `Sala ${SUFFIX}`, status: 'INACTIVE' } })).id;
    otherSpaceId = (
      await prisma.space.create({ data: { ownerId: userId, name: `Otra sala ${SUFFIX}`, status: 'INACTIVE' } })
    ).id;
    // Activo porque RE-04 lo exige para confirmar; todos los días de 09:00 a 21:00.
    activeSpaceId = (
      await prisma.space.create({
        data: {
          ownerId: userId,
          name: `Sala activa ${SUFFIX}`,
          status: 'ACTIVE',
          rulesWeek: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' })),
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const spaces = [spaceId, otherSpaceId, activeSpaceId];
    await prisma.payment.deleteMany({ where: { booking: { spaceId: { in: spaces } } } });
    await prisma.booking.deleteMany({ where: { spaceId: { in: spaces } } });
    await prisma.space.deleteMany({ where: { id: { in: spaces } } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('finaliza y expira solo lo vencido, deja el evento de cada cambio y la segunda vez no cambia nada', async () => {
    const ended = await booking('CONFIRMED', at('2000-01-10T10:00:00Z'), { endAt: NOW });
    const ongoing = await booking('CONFIRMED', at('2000-01-10T12:00:00Z'));
    const stale = await booking('PENDING', at('2000-01-11T10:00:00Z'), { expiresAt: NOW });
    const fresh = await booking('PENDING', at('2000-01-11T11:00:00Z'), { expiresAt: new Date(NOW.getTime() + 1) });
    const noDeadline = await booking('PENDING', at('2000-01-11T12:00:00Z'), { expiresAt: null });
    const past = new Date(NOW.getTime() - HOUR);
    const untouched = await Promise.all(
      (['PAID', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const).map((status, i) =>
        booking(status, new Date(Date.UTC(2000, 0, 1, i)), { expiresAt: past }),
      ),
    );

    const first = await expiry.sweep(NOW);

    expect(first.finished.changed).toBeGreaterThanOrEqual(1);
    expect(first.expired.changed).toBeGreaterThanOrEqual(1);
    expect(first.finished.failed + first.expired.failed).toBe(0);
    expect(await statusOf(ended)).toBe('FINISHED');
    expect(await statusOf(stale)).toBe('EXPIRED');
    expect(await eventsOf(ended)).toEqual([
      { fromStatus: 'CONFIRMED', toStatus: 'FINISHED', actorId: null, reason: FINISHED_REASON },
    ]);
    expect(await eventsOf(stale)).toEqual([
      { fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null, reason: EXPIRED_REASON },
    ]);
    for (const [id, status] of [
      [ongoing, 'CONFIRMED'],
      [fresh, 'PENDING'],
      [noDeadline, 'PENDING'],
      [untouched[0], 'PAID'],
      [untouched[1], 'FINISHED'],
      [untouched[2], 'CANCELLED'],
      [untouched[3], 'EXPIRED'],
    ] as const) {
      expect(await statusOf(id)).toBe(status);
      expect(await eventsOf(id)).toEqual([]);
    }

    const second = await expiry.sweep(NOW);

    expect(second).toEqual({
      finished: { changed: 0, skipped: 0, failed: 0 },
      expired: { changed: 0, skipped: 0, failed: 0 },
      stuckPaid: { changed: 0, skipped: 0, failed: 0 },
    });
    expect(await eventsOf(ended)).toHaveLength(1);
    expect(await eventsOf(stale)).toHaveLength(1);
  });

  it('una pendiente expirada libera su horario para otra reserva', async () => {
    const startAt = at('2000-01-12T10:00:00Z');
    const stale = await booking('PENDING', startAt, { expiresAt: NOW });

    // Mientras sigue PENDING, aunque haya vencido, la restricción booking_no_overlap no deja insertar otra.
    await expect(booking('PENDING', startAt, { expiresAt: new Date(NOW.getTime() + 30 * 60_000) })).rejects.toThrow();

    await expiry.sweep(NOW);
    const next = await booking('PENDING', startAt, { expiresAt: new Date(NOW.getTime() + 30 * 60_000) });

    expect(await statusOf(stale)).toBe('EXPIRED');
    expect(await statusOf(next)).toBe('PENDING');
  });

  describe('expireStalePending, como la usará RE-02', () => {
    it('en la misma transacción expira la vencida del espacio y deja insertar en su horario', async () => {
      const startAt = at('2000-01-13T10:00:00Z');
      const stale = await booking('PENDING', startAt, { expiresAt: NOW });
      const elsewhere = await booking('PENDING', startAt, { expiresAt: NOW, space: otherSpaceId });

      const next = await prisma.$transaction(async (tx) => {
        const count = await expiry.expireStalePending(tx, NOW, spaceId);
        expect(count).toEqual({ changed: 1, skipped: 0, failed: 0 });
        const created = await tx.booking.create({
          data: {
            spaceId,
            renterId: userId,
            startAt,
            endAt: new Date(startAt.getTime() + HOUR),
            unit: 'HOUR',
            subtotal: 10000,
            total: 10000,
            expiresAt: new Date(NOW.getTime() + 30 * 60_000),
          },
        });
        return created.id;
      });

      expect(await statusOf(stale)).toBe('EXPIRED');
      expect(await eventsOf(stale)).toEqual([
        { fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null, reason: EXPIRED_REASON },
      ]);
      expect(await statusOf(next)).toBe('PENDING');
      // La del otro espacio no se tocó.
      expect(await statusOf(elsewhere)).toBe('PENDING');
      expect(await eventsOf(elsewhere)).toEqual([]);
    });

    it('si la transacción de quien llama se deshace, la pendiente sigue PENDING y sin evento', async () => {
      const stale = await booking('PENDING', at('2000-01-14T10:00:00Z'), { expiresAt: NOW });

      await expect(
        prisma.$transaction(async (tx) => {
          await expiry.expireStalePending(tx, NOW, spaceId);
          throw new Error('falla posterior de quien llama');
        }),
      ).rejects.toThrow('falla posterior');

      expect(await statusOf(stale)).toBe('PENDING');
      expect(await eventsOf(stale)).toEqual([]);
    });
  });

  // RE-04. Las fechas salen de `bookingWeek` con el reloj de este archivo. El evento hacia `PAID` lleva una fecha del
  // año 2000, así el barrido de este archivo no alcanza las `PAID` de otros e2e, ni el de otros las de este.
  describe('PAID atascadas', () => {
    const FUTURE = bookingWeek(1, NOW);
    const TOTAL = 26400;
    let day = 0;

    /** Una `PAID` con su pago, y su evento hacia `PAID` hace `paidAgo` ms. */
    const stuck = async (paidAgo: number, space = activeSpaceId) => {
      day += 1;
      const id = await booking('PAID', new Date(FUTURE(day, 10)), { space });
      await prisma.bookingEvent.create({
        data: {
          bookingId: id,
          fromStatus: 'PENDING',
          toStatus: 'PAID',
          actorId: null,
          createdAt: new Date(NOW.getTime() - paidAgo),
        },
      });
      await prisma.payment.create({
        data: {
          bookingId: id,
          stripeSessionId: `cs_test_${SUFFIX}_${id}`,
          stripePaymentIntentId: `pi_test_${SUFFIX}_${id}`,
          amount: TOTAL,
          status: 'SUCCEEDED',
        },
      });
      return id;
    };
    const OVERDUE = STUCK_PAID_AFTER_MS + 1;

    beforeEach(() => {
      refunder.refundBooking.mockReset();
      refunder.refundBooking.mockResolvedValue(undefined);
    });

    it('resuelve la que lleva más de 5 minutos, con el reloj del barrido, y no la más reciente', async () => {
      const old = await stuck(OVERDUE);
      const recent = await stuck(STUCK_PAID_AFTER_MS - 60_000);

      const result = await expiry.sweep(NOW);

      expect(await statusOf(old)).toBe('CONFIRMED');
      expect(await statusOf(recent)).toBe('PAID');
      expect(await eventsOf(recent)).toHaveLength(1);
      expect(result.stuckPaid).toEqual({ changed: 1, skipped: 0, failed: 0 });
      expect(refunder.refundBooking).not.toHaveBeenCalled();
      expect((await expiry.sweep(NOW)).stuckPaid.changed).toBe(0);
    });

    it('una que no pasa la validación queda CANCELLED con reembolso del total', async () => {
      const id = await stuck(OVERDUE, spaceId);

      await expiry.sweep(NOW);

      expect(await statusOf(id)).toBe('CANCELLED');
      expect((await eventsOf(id)).at(-1)).toEqual({
        fromStatus: 'PAID',
        toStatus: 'CANCELLED',
        actorId: null,
        reason: SPACE_UNAVAILABLE_REASON,
      });
      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
      expect(refunder.refundBooking).toHaveBeenCalledWith(id, TOTAL, expect.any(String));
    });

    it('una que falla no detiene a la siguiente, y el próximo barrido la resuelve', async () => {
      const ids = [await stuck(OVERDUE), await stuck(OVERDUE)].sort();
      const confirmation = app.get(BookingConfirmationService);
      const real = confirmation.confirm.bind(confirmation);
      const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      // La primera que lee el barrido, que va por id.
      const spy = jest
        .spyOn(confirmation, 'confirm')
        .mockImplementation((id, now) => (id === ids[0] ? Promise.reject(new Error('se cayó la base')) : real(id, now)));

      const result = await expiry.sweep(NOW);

      spy.mockRestore();
      log.mockRestore();
      expect(result.stuckPaid).toEqual({ changed: 1, skipped: 0, failed: 1 });
      expect(await statusOf(ids[0])).toBe('PAID');
      expect(await statusOf(ids[1])).toBe('CONFIRMED');

      expect((await expiry.sweep(NOW)).stuckPaid).toEqual({ changed: 1, skipped: 0, failed: 0 });
      expect(await statusOf(ids[0])).toBe('CONFIRMED');
    });

    it('barridos simultáneos resuelven cada una una sola vez', async () => {
      const id = await stuck(OVERDUE, spaceId);

      await Promise.all([expiry.sweep(NOW), expiry.sweep(NOW)]);

      expect(await statusOf(id)).toBe('CANCELLED');
      expect((await eventsOf(id)).filter((event) => event.toStatus === 'CANCELLED')).toHaveLength(1);
      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
    });
  });

  it('barridos simultáneos cambian cada reserva una sola vez', async () => {
    const ids = await Promise.all(
      [0, 1, 2, 3, 4].map((i) => booking('PENDING', new Date(Date.UTC(2000, 0, 15, i)), { expiresAt: NOW })),
    );

    const results = await Promise.all([expiry.sweep(NOW), expiry.sweep(NOW), expiry.sweep(NOW)]);

    expect(results.reduce((sum, r) => sum + r.expired.failed, 0)).toBe(0);
    for (const id of ids) {
      expect(await statusOf(id)).toBe('EXPIRED');
      expect(await eventsOf(id)).toHaveLength(1);
    }
  });
});
