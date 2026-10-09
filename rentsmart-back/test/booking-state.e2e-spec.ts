import { ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
import { App } from 'supertest/types';
import { BookingStateService } from '../src/bookings/booking-state.service';
import { canTransition } from '../src/bookings/booking-transitions';
import { BookingStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// RE-01: la máquina de estados contra la base de test. No tiene endpoints propios, así que se prueba el servicio.
const SUFFIX = `e2e-re01-${Date.now()}`;
const STATUSES = Object.values(BookingStatus);
const PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));
const HOUR = 60 * 60 * 1000;

describe('Estados de la reserva (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let states: BookingStateService;
  let userId: string;
  let spaceId: string;
  let slot = 0;

  /** Cada reserva ocupa una hora distinta: `booking_no_overlap` no deja traslapar dos activas del mismo espacio. */
  const createBooking = (status: BookingStatus = 'PENDING') => {
    const startAt = new Date(Date.UTC(2030, 0, 1) + slot++ * HOUR);
    return prisma.booking.create({
      data: {
        spaceId,
        renterId: userId,
        startAt,
        endAt: new Date(startAt.getTime() + HOUR),
        unit: 'HOUR',
        subtotal: 10000,
        total: 10000,
        status,
      },
    });
  };
  const statusOf = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
  const eventsOf = (bookingId: string) =>
    prisma.bookingEvent.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    states = app.get(BookingStateService);
    const user = await prisma.user.create({
      data: { email: `user-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: 'Estados' },
    });
    userId = user.id;
    const space = await prisma.space.create({ data: { ownerId: userId, name: `Espacio ${SUFFIX}` } });
    spaceId = space.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.delete({ where: { id: spaceId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('los 36 pares de estados', () => {
    it.each(PAIRS)('%s → %s', async (from, to) => {
      const booking = await createBooking(from);
      const result = states.transition(booking.id, to, { actorId: userId, reason: 'prueba por tabla' });

      if (canTransition(from, to)) {
        await expect(result).resolves.toMatchObject({ id: booking.id, status: to });
        expect(await statusOf(booking.id)).toBe(to);
        expect(await eventsOf(booking.id)).toHaveLength(1);
      } else {
        await expect(result).rejects.toBeInstanceOf(ConflictException);
        expect(await statusOf(booking.id)).toBe(from);
        expect(await eventsOf(booking.id)).toHaveLength(0);
      }
    });
  });

  it('escribe el evento con quién, cuándo y motivo', async () => {
    const booking = await createBooking('CONFIRMED');
    const before = Date.now();

    await states.transition(booking.id, 'CANCELLED', { actorId: userId, reason: 'El arrendatario canceló' });

    const [event, ...rest] = await eventsOf(booking.id);
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      fromStatus: 'CONFIRMED',
      toStatus: 'CANCELLED',
      actorId: userId,
      reason: 'El arrendatario canceló',
    });
    // Un minuto de margen: la fecha la pone la base, cuyo reloj puede no coincidir con el del test.
    expect(Math.abs(event.createdAt.getTime() - before)).toBeLessThan(60_000);
  });

  it('un cambio del sistema queda sin actor ni motivo', async () => {
    const booking = await createBooking();

    await states.transition(booking.id, 'EXPIRED', { actorId: null });

    expect(await eventsOf(booking.id)).toMatchObject([
      { fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null, reason: null },
    ]);
  });

  it('guarda el historial completo de una reserva, en orden', async () => {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          spaceId,
          renterId: userId,
          startAt: new Date(Date.UTC(2030, 0, 1) + slot * HOUR),
          endAt: new Date(Date.UTC(2030, 0, 1) + ++slot * HOUR),
          unit: 'HOUR',
          subtotal: 10000,
          total: 10000,
        },
      });
      await states.recordCreation(created.id, { actorId: userId }, tx);
      return created;
    });

    await states.transition(booking.id, 'PAID', { actorId: null, reason: 'Pago recibido' });
    await states.transition(booking.id, 'CONFIRMED', { actorId: null, reason: 'Validación automática' });
    await states.transition(booking.id, 'FINISHED', { actorId: null, reason: 'Terminó el horario' });

    const events = await eventsOf(booking.id);
    expect(events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      [null, 'PENDING'],
      ['PENDING', 'PAID'],
      ['PAID', 'CONFIRMED'],
      ['CONFIRMED', 'FINISHED'],
    ]);
    expect(events[0].actorId).toBe(userId);
  });

  it('una transición inválida no deja evento ni cambia el estado', async () => {
    const booking = await createBooking('FINISHED');

    await expect(states.transition(booking.id, 'CANCELLED', { actorId: userId })).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(await statusOf(booking.id)).toBe('FINISHED');
    expect(await eventsOf(booking.id)).toHaveLength(0);
  });

  it('responde 404 si la reserva no existe', async () => {
    await expect(
      states.transition('00000000-0000-0000-0000-000000000000', 'PAID', { actorId: null }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['el mismo destino', 'PAID', 'PAID'],
    ['destinos distintos', 'PAID', 'CANCELLED'],
  ] as const)('de dos cambios simultáneos con %s pasa uno solo', async (_caso, first, second) => {
    // Varias rondas: una sola podría pasar por suerte aunque la actualización no fuera condicionada.
    for (let round = 0; round < 10; round++) {
      const booking = await createBooking();

      const results = await Promise.allSettled([
        states.transition(booking.id, first, { actorId: null, reason: 'primero' }),
        states.transition(booking.id, second, { actorId: userId, reason: 'segundo' }),
      ]);

      const won = results.filter((result) => result.status === 'fulfilled');
      const lost = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(lost[0].reason).toBeInstanceOf(ConflictException);

      const events = await eventsOf(booking.id);
      expect(events).toHaveLength(1);
      expect(events[0].fromStatus).toBe('PENDING');
      expect(await statusOf(booking.id)).toBe(events[0].toStatus);
    }
  });

  describe('dentro de la transacción de quien llama', () => {
    it('el cambio y el evento se confirman junto con el resto', async () => {
      const booking = await createBooking();

      await prisma.$transaction(async (tx) => {
        await states.transition(booking.id, 'PAID', { actorId: null }, tx);
        await states.transition(booking.id, 'CONFIRMED', { actorId: null }, tx);
      });

      expect(await statusOf(booking.id)).toBe('CONFIRMED');
      expect(await eventsOf(booking.id)).toHaveLength(2);
    });

    it('si la transacción se deshace, no queda ni el cambio ni el evento', async () => {
      const booking = await createBooking();

      await expect(
        prisma.$transaction(async (tx) => {
          await states.transition(booking.id, 'PAID', { actorId: null }, tx);
          throw new Error('falla posterior de quien llama');
        }),
      ).rejects.toThrow('falla posterior');

      expect(await statusOf(booking.id)).toBe('PENDING');
      expect(await eventsOf(booking.id)).toHaveLength(0);
    });

    it('una transición inválida a mitad de camino deshace los cambios anteriores', async () => {
      const booking = await createBooking();

      await expect(
        prisma.$transaction(async (tx) => {
          await states.transition(booking.id, 'PAID', { actorId: null }, tx);
          await states.transition(booking.id, 'FINISHED', { actorId: null }, tx);
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(await statusOf(booking.id)).toBe('PENDING');
      expect(await eventsOf(booking.id)).toHaveLength(0);
    });
  });
});
