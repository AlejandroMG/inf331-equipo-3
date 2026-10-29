import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AvailabilityService } from '../src/availability/availability.service';
import { isOverlapViolation, OVERLAP_MESSAGE } from '../src/bookings/overlap-error';
import { BookingStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// RE-03: dos reservas activas del mismo espacio nunca se traslapan. Lo cuidan tres capas: un lock por espacio, `isAvailable`
// en el servicio y la restricción `booking_no_overlap` en Postgres. Si igual rechaza la base (por ejemplo, porque la
// revisión del servicio falló), la API responde 409, no 500. Fechas relativas a hoy con `bookingWeek`.
const SUFFIX = `e2e-re03-${Date.now()}`;
const WEEKDAYS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' }));
const at = bookingWeek();
/** Los estados que bloquean el horario, igual que el `WHERE` de `booking_no_overlap` (P-06). */
const HOLDING: BookingStatus[] = ['PENDING', 'PAID', 'CONFIRMED'];
/** El 409 de la revisión del servicio (`isAvailable`). */
const UNAVAILABLE_MESSAGE = 'Ese horario no está disponible: está fuera del horario del espacio o alguien ya lo reservó';

describe('Reservas cruzadas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterA: string;
  let renterB: string;
  const spaceIds: string[] = [];

  const server = () => app.getHttpServer();
  const book = (userId: string, spaceId: string, startAt: string, endAt: string) =>
    request(server()).post('/api/bookings').set(bearer(app, userId)).send({ spaceId, startAt, endAt, unit: 'HOUR' });

  let counter = 0;
  const space = async () => {
    counter += 1;
    const created = await prisma.space.create({
      data: {
        ownerId,
        name: `Sala ${counter} ${SUFFIX}`,
        status: 'ACTIVE',
        address: 'Alameda 123',
        pricePerHour: 12000,
        rulesWeek: { create: WEEKDAYS },
      },
    });
    spaceIds.push(created.id);
    return created.id;
  };

  /** Inserta una reserva directo en la base, sin pasar por el servicio. */
  const insert = (spaceId: string, status: BookingStatus, startAt: string, endAt: string) =>
    prisma.booking.create({
      data: {
        spaceId,
        renterId: renterA,
        status,
        unit: 'HOUR',
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        subtotal: 12000,
        fee: 1200,
        total: 13200,
      },
    });

  /** Cuántas reservas retienen algún instante de [startAt, endAt) en ese espacio. */
  const holding = (spaceId: string, startAt: string, endAt: string) =>
    prisma.booking.count({
      where: { spaceId, status: { in: HOLDING }, startAt: { lt: new Date(endAt) }, endAt: { gt: new Date(startAt) } },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterA = (await user('renter-a')).id;
    renterB = (await user('renter-b')).id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { spaceId: { in: spaceIds } } });
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterA, renterB] } } });
    await app.close();
  });

  describe('restricción booking_no_overlap, directo en la base', () => {
    it('rechaza una CONFIRMED que se traslapa con otra CONFIRMED del mismo espacio, y isOverlapViolation la reconoce', async () => {
      const id = await space();
      await insert(id, 'CONFIRMED', at(0, 10), at(0, 12));

      const error = await insert(id, 'CONFIRMED', at(0, 11), at(0, 13)).catch((e: unknown) => e);

      // La forma real del error (Prisma 7 con @prisma/adapter-pg) es la del fixture de los unitarios.
      expect(error).toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2039',
        meta: { driverAdapterError: { cause: { kind: 'postgres', originalCode: '23P01' } } },
      });
      expect(isOverlapViolation(error)).toBe(true);
      expect(await holding(id, at(0, 10), at(0, 13))).toBe(1);
    });

    it.each(HOLDING)('una %s también bloquea el horario', async (status) => {
      const id = await space();
      await insert(id, status, at(0, 10), at(0, 12));

      const error = await insert(id, 'CONFIRMED', at(0, 10), at(0, 12)).catch((e: unknown) => e);

      expect(isOverlapViolation(error)).toBe(true);
    });

    it.each(['CANCELLED', 'EXPIRED', 'FINISHED'] as const)(
      'una %s no bloquea: el mismo horario se puede confirmar, y al revés también se inserta',
      async (status) => {
        const id = await space();
        await insert(id, status, at(0, 10), at(0, 12));

        await insert(id, 'CONFIRMED', at(0, 10), at(0, 12));
        // Una reserva que no retiene el horario se puede guardar encima de una activa (el WHERE de la restricción).
        await insert(id, status, at(0, 11), at(0, 13));

        expect(await holding(id, at(0, 10), at(0, 13))).toBe(1);
      },
    );

    it('no choca un rango contiguo (semiabierto) ni el mismo horario en otro espacio', async () => {
      const id = await space();
      const other = await space();
      await insert(id, 'CONFIRMED', at(0, 10), at(0, 12));

      await insert(id, 'CONFIRMED', at(0, 12), at(0, 13));
      await insert(id, 'CONFIRMED', at(0, 9), at(0, 10));
      await insert(other, 'CONFIRMED', at(0, 10), at(0, 12));

      expect(await holding(id, at(0, 9), at(0, 13))).toBe(3);
    });
  });

  describe('POST /api/bookings', () => {
    it('si la revisión del servicio deja pasar un horario tomado, la base lo rechaza y la API responde 409, no 500', async () => {
      const id = await space();
      await book(renterA, id, at(0, 10), at(0, 12)).expect(201);
      // Simula la carrera de forma determinista: las dos solicitudes pasaron isAvailable antes de que una insertara.
      const availability = app.get(AvailabilityService);
      const passes = jest.spyOn(availability, 'isAvailable').mockResolvedValue(true);

      try {
        const { body } = await book(renterB, id, at(0, 11), at(0, 13)).expect(409);
        expect(body).toMatchObject({ statusCode: 409, message: OVERLAP_MESSAGE });
        expect(passes).toHaveBeenCalledTimes(1);
      } finally {
        passes.mockRestore();
      }

      // La transacción se deshizo: no queda la reserva ni su evento.
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(1);
      expect(await prisma.bookingEvent.count({ where: { booking: { spaceId: id } } })).toBe(1);
    });

    it('con la revisión del servicio dejando pasar a dos solicitudes simultáneas, la segunda espera el lock y la base la rechaza con 409', async () => {
      const id = await space();
      const availability = app.get(AvailabilityService);
      const passes = jest.spyOn(availability, 'isAvailable').mockResolvedValue(true);

      try {
        const responses = await Promise.all([
          book(renterA, id, at(0, 10), at(0, 12)),
          book(renterB, id, at(0, 11), at(0, 13)),
        ]);

        // Sin el lock, dos INSERT simultáneos contra la restricción de exclusión pueden terminar en deadlock (500).
        expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
        const loser = responses.find((response) => response.status === 409)!;
        expect(loser.body).toMatchObject({ message: OVERLAP_MESSAGE });
        expect(passes).toHaveBeenCalledTimes(2);
      } finally {
        passes.mockRestore();
      }
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(1);
    });

    it('de dos solicitudes simultáneas por el mismo horario, una responde 201 y la otra 409, en 5 horarios distintos', async () => {
      const id = await space();
      // Lunes a viernes de 10:00 a 11:00: cinco carreras independientes en el mismo espacio.
      for (const day of [0, 1, 2, 3, 4]) {
        const [first, second] = await Promise.all([
          book(renterA, id, at(day, 10), at(day, 11)),
          book(renterB, id, at(day, 10), at(day, 11)),
        ]);

        expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);
        const loser = first.status === 409 ? first : second;
        // El lock del espacio las pone en fila: la segunda revisa después del COMMIT de la primera y ya ve el horario
        // tomado. El 409 sale siempre de la revisión del servicio, no de la restricción.
        expect(loser.body).toMatchObject({ message: UNAVAILABLE_MESSAGE });
        expect(await holding(id, at(day, 10), at(day, 11))).toBe(1);
      }
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(5);
    });

    it('con un traslape parcial simultáneo (10–12 contra 11–13) también pasa solo una', async () => {
      const id = await space();

      const responses = await Promise.all([
        book(renterA, id, at(0, 10), at(0, 12)),
        book(renterB, id, at(0, 11), at(0, 13)),
      ]);

      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(responses.find((response) => response.status === 409)!.body).toMatchObject({ message: UNAVAILABLE_MESSAGE });
      expect(await holding(id, at(0, 10), at(0, 13))).toBe(1);
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(1);
    });
  });
});
