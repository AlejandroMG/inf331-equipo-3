import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { EXPIRED_REASON, FINISHED_REASON, BookingExpiryService } from '../src/bookings/booking-expiry.service';
import { BookingStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
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
    app = await createTestApp();
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
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.space.deleteMany({ where: { id: { in: [spaceId, otherSpaceId] } } });
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
