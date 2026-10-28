import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AvailabilityService } from '../src/availability/availability.service';
import { santiagoWallClock } from '../src/common/santiago-time';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// F-05: el contrato de disponibilidad, reservas y pagos. Comprueba la forma (Swagger, 400 y 401), no la lógica:
// cada historia (PA-01, PA-02) reemplaza su 501 por sus propios tests. El horario semanal (DI-01) ya
// está implementado: sus e2e están en schedule.e2e-spec.ts. La disponibilidad (DI-02) también: sus e2e están abajo.
// Reservar y consultar (RE-02) también: sus e2e están en booking-create.e2e-spec.ts.
const SUFFIX = `e2e-f05-${Date.now()}`;
const HOUR = 3_600_000;
const SPACE = 'un-espacio';
const BOOKING = 'una-reserva';

// Fechas calculadas desde hoy (el lunes a 4 semanas, en la hora de Chile; ver utils/booking-dates.ts): una fecha fija
// termina pasando y entonces el servicio responde 400 por «ya pasó» antes de llegar a lo que se quiere probar.
const at = bookingWeek();
const VALID_BOOKING = {
  spaceId: SPACE,
  startAt: at(0, 9),
  endAt: at(0, 11),
  unit: 'HOUR',
};

interface SwaggerDoc {
  paths: Record<string, Record<string, { responses: Record<string, unknown>; security?: unknown[] }>>;
  components: { schemas: Record<string, { properties: Record<string, unknown>; required?: string[] }> };
}

describe('Contrato de disponibilidad, reservas y pagos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  const server = () => app.getHttpServer();
  const auth = () => bearer(app, userId);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: { email: `user-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: 'Contrato' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('Swagger', () => {
    let doc: SwaggerDoc;

    beforeAll(async () => {
      doc = (await request(server()).get('/docs-json').expect(200)).body as SwaggerDoc;
    });

    it.each([
      ['get', '/api/spaces/{id}/availability', ['200', '400', '404']],
      ['get', '/api/spaces/{id}/schedule', ['200', '401', '403', '404']],
      ['put', '/api/spaces/{id}/schedule', ['200', '400', '401', '403', '404', '409']],
      ['post', '/api/bookings', ['201', '400', '401', '403', '404', '409']],
      ['get', '/api/bookings/me', ['200', '400', '401']],
      ['get', '/api/bookings/{id}', ['200', '401', '403', '404']],
      ['post', '/api/bookings/{id}/cancel', ['200', '400', '401', '403', '404', '409']],
      ['post', '/api/payments/webhook', ['200', '400']],
      ['get', '/api/payments/me', ['200', '400', '401']],
    ])('documenta %s %s con sus respuestas', (method, path, codes) => {
      const operation = doc.paths[path]?.[method];

      expect(operation).toBeDefined();
      expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(codes));
    });

    it('marca con sesión los endpoints privados y sin sesión los públicos', () => {
      expect(doc.paths['/api/bookings'].post.security).toBeDefined();
      expect(doc.paths['/api/spaces/{id}/schedule'].put.security).toBeDefined();
      expect(doc.paths['/api/payments/me'].get.security).toBeDefined();
      expect(doc.paths['/api/spaces/{id}/availability'].get.security).toBeUndefined();
      expect(doc.paths['/api/payments/webhook'].post.security).toBeUndefined();
    });

    it('describe los DTOs con los campos del contrato', () => {
      const fields = (name: string) => Object.keys(doc.components.schemas[name].properties).sort();

      expect(fields('CreateBookingDto')).toEqual(['endAt', 'spaceId', 'startAt', 'unit']);
      expect(fields('BookingCheckoutDto')).toEqual(['bookingId', 'checkoutUrl']);
      expect(fields('BookingDto')).toEqual([
        'createdAt', 'endAt', 'expiresAt', 'fee', 'id', 'space', 'startAt', 'status', 'subtotal', 'total', 'unit',
      ]);
      expect(fields('BookingSpaceDto')).toEqual(['address', 'addressDetail', 'communeName', 'coverUrl', 'id', 'name']);
      expect(fields('BookingsPageDto')).toEqual(['items', 'page', 'pageSize', 'total']);
      expect(fields('AvailabilityDto')).toEqual(['days', 'spaceId', 'timeZone']);
      expect(fields('AvailabilityDayDto')).toEqual(['date', 'fullDay', 'slots']);
      expect(fields('ScheduleRuleDto')).toEqual(['endTime', 'startTime', 'weekday']);
      expect(fields('PaymentDto')).toEqual([
        'amount', 'bookingId', 'createdAt', 'fee', 'id', 'refundedAmount', 'spaceName', 'status',
      ]);
    });

    it('los estados de la reserva son los seis del ciclo de vida', () => {
      const status = doc.components.schemas.BookingDto.properties.status as { enum: string[] };

      expect(status.enum).toEqual(['PENDING', 'PAID', 'CONFIRMED', 'FINISHED', 'CANCELLED', 'EXPIRED']);
    });
  });

  describe('sin sesión', () => {
    it.each([
      ['get', `/api/spaces/${SPACE}/schedule`],
      ['put', `/api/spaces/${SPACE}/schedule`],
      ['post', '/api/bookings'],
      ['get', '/api/bookings/me'],
      ['get', `/api/bookings/${BOOKING}`],
      ['post', `/api/bookings/${BOOKING}/cancel`],
      ['get', '/api/payments/me'],
    ] as const)('%s %s responde 401', async (method, path) => {
      await request(server())[method](path).expect(401);
      await request(server())[method](path).set('Authorization', 'Bearer no-es-un-token').expect(401);
    });

    it('la disponibilidad es pública: no pide sesión', async () => {
      const { status } = await request(server()).get(`/api/spaces/${SPACE}/availability?from=2026-10-12&to=2026-10-18`);

      expect(status).not.toBe(401);
    });

    it('el webhook no pide sesión, pero sin la firma de Stripe responde 400', async () => {
      await request(server()).post('/api/payments/webhook').send({ type: 'checkout.session.completed' }).expect(400);
    });
  });

  describe('datos inválidos', () => {
    it.each([
      ['sin fechas', ''],
      ['sin la fecha final', '?from=2026-10-12'],
      ['con una fecha con hora', '?from=2026-10-12T00:00:00Z&to=2026-10-18'],
      ['con un mes que no existe', '?from=2026-13-01&to=2026-13-02'],
      ['con un parámetro desconocido', '?from=2026-10-12&to=2026-10-18&otro=1'],
    ])('GET availability %s responde 400', (_name, query) => {
      return request(server()).get(`/api/spaces/${SPACE}/availability${query}`).expect(400);
    });

    it.each([
      ['sin rules', {}],
      ['con rules que no es una lista', { rules: 'lunes' }],
      ['con un día fuera de 0 a 6', { rules: [{ weekday: 7, startTime: '09:00', endTime: '10:00' }] }],
      ['con una hora que no es cerrada', { rules: [{ weekday: 1, startTime: '09:30', endTime: '10:00' }] }],
      ['con un fin que no es una hora', { rules: [{ weekday: 1, startTime: '09:00', endTime: '25:00' }] }],
      ['con un campo desconocido', { rules: [], otro: 1 }],
    ])('PUT schedule %s responde 400', (_name, body) => {
      return request(server()).put(`/api/spaces/${SPACE}/schedule`).set(auth()).send(body).expect(400);
    });

    it.each([
      ['sin datos', {}],
      ['sin el espacio', { ...VALID_BOOKING, spaceId: undefined }],
      ['con un inicio que no es una hora cerrada', { ...VALID_BOOKING, startAt: '2026-10-12T12:30:00.000Z' }],
      ['con un fin que no está en UTC', { ...VALID_BOOKING, endAt: '2026-10-12T11:00:00-03:00' }],
      ['con un día que no existe', { ...VALID_BOOKING, startAt: '2026-02-31T12:00:00.000Z' }],
      ['con una unidad desconocida', { ...VALID_BOOKING, unit: 'WEEK' }],
      ['con el precio puesto por el cliente', { ...VALID_BOOKING, total: 1 }],
    ])('POST bookings %s responde 400', (_name, body) => {
      return request(server()).post('/api/bookings').set(auth()).send(body).expect(400);
    });

    it.each([
      ['/api/bookings/me?page=0'],
      ['/api/bookings/me?pageSize=51'],
      ['/api/bookings/me?otro=1'],
      ['/api/payments/me?page=0'],
      ['/api/payments/me?pageSize=abc'],
    ])('GET %s responde 400', (path) => {
      return request(server()).get(path).set(auth()).expect(400);
    });
  });

  // DI-02: la disponibilidad contra la base de test. Las fechas son de 2030 para que no pasen: en octubre Chile está
  // en UTC-3 y el lunes 14 a las 09:00 son las 12:00 UTC.
  describe('GET /api/spaces/:id/availability (DI-02)', () => {
    type Rule = { weekday: number; startTime: string; endTime: string };
    type Status = 'PENDING' | 'PAID' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FINISHED';
    interface Day {
      date: string;
      slots: Array<{ startAt: string; endAt: string }>;
      fullDay: { startAt: string; endAt: string; available: boolean } | null;
    }

    const rule = (weekday: number, startTime: string, endTime: string): Rule => ({ weekday, startTime, endTime });
    const WEEKDAYS = [1, 2, 3, 4, 5].map((weekday) => rule(weekday, '09:00', '21:00'));
    const ALWAYS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => rule(weekday, '00:00', '24:00'));
    const starts = (day: Day) => day.slots.map((slot) => slot.startAt);
    const at = (iso: string) => new Date(iso);

    let ownerId: string;
    let renterId: string;
    let availability: AvailabilityService;

    let counter = 0;
    const space = async (status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED', rules: Rule[]) => {
      counter += 1;
      const created = await prisma.space.create({
        data: { ownerId, name: `Disponibilidad ${counter} ${SUFFIX}`, status, rulesWeek: { create: rules } },
      });
      return created.id;
    };
    const book = (spaceId: string, startAt: string, endAt: string, status: Status, expiresAt: Date | null = null) =>
      prisma.booking.create({
        data: {
          spaceId,
          renterId,
          startAt: at(startAt),
          endAt: at(endAt),
          unit: 'HOUR',
          subtotal: 12000,
          fee: 1200,
          total: 13200,
          status,
          expiresAt,
        },
      });
    const get = (spaceId: string, from: string, to: string) =>
      request(server()).get(`/api/spaces/${spaceId}/availability?from=${from}&to=${to}`);
    const days = async (spaceId: string, from: string, to: string) =>
      ((await get(spaceId, from, to).expect(200)).body as { days: Day[] }).days;

    beforeAll(async () => {
      availability = app.get(AvailabilityService);
      const user = (key: string) =>
        prisma.user.create({
          data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key },
        });
      ownerId = (await user('owner')).id;
      renterId = (await user('renter')).id;
    });

    afterAll(async () => {
      await prisma.booking.deleteMany({ where: { renterId } });
      await prisma.space.deleteMany({ where: { ownerId } });
      await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } });
    });

    it('es pública y trae, por cada día de Chile, los bloques libres en UTC y el día completo', async () => {
      const id = await space('ACTIVE', WEEKDAYS);

      const { body } = await get(id, '2030-10-13', '2030-10-14').expect(200);

      expect(body).toMatchObject({ spaceId: id, timeZone: 'America/Santiago' });
      const [sunday, monday] = (body as { days: Day[] }).days;
      // El domingo no se arrienda.
      expect(sunday).toEqual({ date: '2030-10-13', slots: [], fullDay: null });
      expect(monday.date).toBe('2030-10-14');
      expect(monday.slots).toHaveLength(12);
      expect(monday.slots[0]).toEqual({ startAt: '2030-10-14T12:00:00.000Z', endAt: '2030-10-14T13:00:00.000Z' });
      expect(monday.slots[11]).toEqual({ startAt: '2030-10-14T23:00:00.000Z', endAt: '2030-10-15T00:00:00.000Z' });
      expect(monday.fullDay).toEqual({
        startAt: '2030-10-14T12:00:00.000Z',
        endAt: '2030-10-15T00:00:00.000Z',
        available: true,
      });
    });

    it('descuenta las reservas que retienen el horario y deja libres las contiguas, las vencidas y las canceladas', async () => {
      const id = await space('ACTIVE', WEEKDAYS);
      const future = new Date(Date.now() + HOUR);
      const past = new Date(Date.now() - HOUR);
      // Lunes 14, en Chile.
      await book(id, '2030-10-14T13:00:00Z', '2030-10-14T15:00:00Z', 'CONFIRMED'); // 10:00 a 12:00
      await book(id, '2030-10-14T15:00:00Z', '2030-10-14T16:00:00Z', 'PENDING', future); // 12:00, pegada a la anterior
      await book(id, '2030-10-14T17:00:00Z', '2030-10-14T18:00:00Z', 'PAID'); // 14:00
      await book(id, '2030-10-14T18:00:00Z', '2030-10-14T19:00:00Z', 'PENDING', past); // 15:00, vencida
      await book(id, '2030-10-14T20:00:00Z', '2030-10-14T21:00:00Z', 'CANCELLED'); // 17:00

      const [monday] = await days(id, '2030-10-14', '2030-10-14');

      expect(starts(monday)).toEqual([
        '2030-10-14T12:00:00.000Z',
        '2030-10-14T16:00:00.000Z',
        '2030-10-14T18:00:00.000Z',
        '2030-10-14T19:00:00.000Z',
        '2030-10-14T20:00:00.000Z',
        '2030-10-14T21:00:00.000Z',
        '2030-10-14T22:00:00.000Z',
        '2030-10-14T23:00:00.000Z',
      ]);
      expect(monday.fullDay?.available).toBe(false);
    });

    it('un día con dos rangos y una pausa: no ofrece la pausa, pero el día completo la incluye', async () => {
      const id = await space('ACTIVE', [rule(2, '09:00', '13:00'), rule(2, '15:00', '18:00')]);

      const [tuesday] = await days(id, '2030-10-15', '2030-10-15');

      expect(tuesday.slots).toHaveLength(7);
      expect(starts(tuesday)).not.toContain('2030-10-15T16:00:00.000Z');
      expect(tuesday.fullDay).toEqual({
        startAt: '2030-10-15T12:00:00.000Z',
        endAt: '2030-10-15T21:00:00.000Z',
        available: true,
      });
    });

    it('un horario hasta las 24:00 y una reserva que cruza la medianoche ocupan horas de los dos días', async () => {
      const id = await space('ACTIVE', [rule(3, '20:00', '24:00'), rule(4, '00:00', '04:00')]);
      // Del miércoles 16 a las 22:00 al jueves 17 a las 02:00, en Chile.
      await book(id, '2030-10-17T01:00:00Z', '2030-10-17T05:00:00Z', 'CONFIRMED');

      const [wednesday, thursday] = await days(id, '2030-10-16', '2030-10-17');

      // El miércoles de 20:00 a 22:00 de Chile ya es el jueves en UTC, pero se lista en el miércoles.
      expect(wednesday.date).toBe('2030-10-16');
      expect(starts(wednesday)).toEqual(['2030-10-16T23:00:00.000Z', '2030-10-17T00:00:00.000Z']);
      expect(wednesday.fullDay?.endAt).toBe('2030-10-17T03:00:00.000Z');
      expect(starts(thursday)).toEqual(['2030-10-17T05:00:00.000Z', '2030-10-17T06:00:00.000Z']);
    });

    it('el domingo de septiembre sin medianoche tiene 23 bloques y el sábado de abril, 25', async () => {
      const id = await space('ACTIVE', ALWAYS);

      // 2030: el domingo 8 de septiembre empieza a la 01:00 (UTC-3) y el sábado 6 de abril repite las 23:00.
      const [, september] = await days(id, '2030-09-07', '2030-09-08');
      const [april] = await days(id, '2030-04-06', '2030-04-06');

      expect(september.slots).toHaveLength(23);
      expect(september.fullDay).toEqual({
        startAt: '2030-09-08T04:00:00.000Z',
        endAt: '2030-09-09T03:00:00.000Z',
        available: true,
      });
      expect(april.slots).toHaveLength(25);
      expect(april.fullDay).toEqual({
        startAt: '2030-04-06T03:00:00.000Z',
        endAt: '2030-04-07T04:00:00.000Z',
        available: true,
      });
    });

    it('no ofrece las horas que ya pasaron', async () => {
      // El endpoint usa el reloj real, así que solo se piden días que ya terminaron: anteayer y ayer en Chile no
      // dependen de la hora a la que corra el test. El borde exacto ("ya empezó") se prueba en las unitarias con un
      // reloj fijo.
      const id = await space('ACTIVE', ALWAYS);
      const today = santiagoWallClock(new Date());
      const date = (plus: number) => new Date(Date.UTC(today.year, today.month - 1, today.day + plus)).toISOString().slice(0, 10);

      const past = await days(id, date(-2), date(-1));

      expect(past).toHaveLength(2);
      for (const day of past) {
        expect(day.slots).toEqual([]);
        expect(day.fullDay?.available).toBe(false);
      }
    });

    it.each([
      ['un día que no existe', '2030-02-30', '2030-03-01'],
      ['from posterior a to', '2030-10-15', '2030-10-14'],
      ['más de 31 días', '2030-10-01', '2030-11-01'],
    ])('responde 400 con %s', async (_name, from, to) => {
      const id = await space('ACTIVE', WEEKDAYS);

      const { body } = await get(id, from, to).expect(400);

      expect(body).toMatchObject({ statusCode: 400 });
    });

    it('acepta 31 días, contando los dos extremos', async () => {
      const id = await space('ACTIVE', WEEKDAYS);

      expect(await days(id, '2030-10-01', '2030-10-31')).toHaveLength(31);
    });

    it('responde 404 si el espacio no existe o no está activo', async () => {
      await get('no-existe', '2030-10-14', '2030-10-14').expect(404);
      for (const status of ['DRAFT', 'INACTIVE', 'BLOCKED'] as const) {
        await get(await space(status, WEEKDAYS), '2030-10-14', '2030-10-14').expect(404);
      }
    });

    describe('isAvailable', () => {
      // Lunes 14 de octubre de 2030 en Chile.
      const MON_10 = at('2030-10-14T13:00:00Z');
      const MON_11 = at('2030-10-14T14:00:00Z');
      const MON_12 = at('2030-10-14T15:00:00Z');
      const MON_13 = at('2030-10-14T16:00:00Z');

      it('rangos semiabiertos: se puede reservar justo después de otra reserva, no encima', async () => {
        const id = await space('ACTIVE', WEEKDAYS);
        await book(id, '2030-10-14T13:00:00Z', '2030-10-14T15:00:00Z', 'CONFIRMED');

        await expect(availability.isAvailable(id, MON_12, MON_13)).resolves.toBe(true);
        await expect(availability.isAvailable(id, MON_11, MON_13)).resolves.toBe(false);
      });

      it('una pendiente vencida no bloquea; una vigente sí', async () => {
        const id = await space('ACTIVE', WEEKDAYS);
        await book(id, '2030-10-14T13:00:00Z', '2030-10-14T14:00:00Z', 'PENDING', new Date(Date.now() - HOUR));
        await book(id, '2030-10-14T14:00:00Z', '2030-10-14T15:00:00Z', 'PENDING', new Date(Date.now() + HOUR));

        await expect(availability.isAvailable(id, MON_10, MON_11)).resolves.toBe(true);
        await expect(availability.isAvailable(id, MON_11, MON_12)).resolves.toBe(false);
      });

      it('es falso fuera del horario y en un espacio que no está activo', async () => {
        const active = await space('ACTIVE', WEEKDAYS);
        const inactive = await space('INACTIVE', WEEKDAYS);

        // El domingo 13 no se arrienda.
        await expect(availability.isAvailable(active, at('2030-10-13T13:00:00Z'), at('2030-10-13T14:00:00Z'))).resolves.toBe(
          false,
        );
        await expect(availability.isAvailable(inactive, MON_10, MON_11)).resolves.toBe(false);
      });

      it("con unit: 'DAY' se reserva entero el día con pausa que ofrece el endpoint, y una reserva en la pausa lo impide", async () => {
        const id = await space('ACTIVE', [rule(2, '09:00', '13:00'), rule(2, '15:00', '18:00')]);
        const [tuesday] = await days(id, '2030-10-15', '2030-10-15');
        const startAt = at(tuesday.fullDay!.startAt);
        const endAt = at(tuesday.fullDay!.endAt);

        await expect(availability.isAvailable(id, startAt, endAt, { unit: 'DAY' })).resolves.toBe(true);
        // Por hora, el mismo rango cruza la pausa.
        await expect(availability.isAvailable(id, startAt, endAt)).resolves.toBe(false);

        // Una reserva que quedó en la pausa (de 13:00 a 14:00 en Chile).
        await book(id, '2030-10-15T16:00:00Z', '2030-10-15T17:00:00Z', 'CONFIRMED');
        const [after] = await days(id, '2030-10-15', '2030-10-15');
        expect(after.fullDay?.available).toBe(false);
        await expect(availability.isAvailable(id, startAt, endAt, { unit: 'DAY' })).resolves.toBe(false);
      });

      it('excludeBookingId: RE-04 valida una reserva PAID que ocupa su propio horario', async () => {
        const id = await space('ACTIVE', WEEKDAYS);
        const paid = await book(id, '2030-10-14T13:00:00Z', '2030-10-14T14:00:00Z', 'PAID');

        await expect(availability.isAvailable(id, MON_10, MON_11)).resolves.toBe(false);
        await expect(availability.isAvailable(id, MON_10, MON_11, { excludeBookingId: paid.id })).resolves.toBe(true);
      });

      it('allowStarted: acepta el bloque que ya empezó y no ha terminado, pero no uno que terminó', async () => {
        // Con un reloj fijo, no el real: se reservó el bloque de 10:00 del lunes 14 y el pago llega a las 10:02.
        const id = await space('ACTIVE', WEEKDAYS);
        const paid = await book(id, '2030-10-14T13:00:00Z', '2030-10-14T14:00:00Z', 'PAID');
        const options = { excludeBookingId: paid.id, now: at('2030-10-14T13:02:00Z') };

        await expect(availability.isAvailable(id, MON_10, MON_11, options)).resolves.toBe(false);
        await expect(availability.isAvailable(id, MON_10, MON_11, { ...options, allowStarted: true })).resolves.toBe(true);
        // El bloque de 09:00 ya terminó a las 10:00: sigue siendo falso.
        await expect(
          availability.isAvailable(id, at('2030-10-14T12:00:00Z'), MON_10, { ...options, allowStarted: true }),
        ).resolves.toBe(false);
        // Y a las 11:00, el de 10:00 también terminó.
        await expect(
          availability.isAvailable(id, MON_10, MON_11, { ...options, now: MON_11, allowStarted: true }),
        ).resolves.toBe(false);
      });

      it('con tx ve lo que ya escribió la transacción de quien llama', async () => {
        const id = await space('ACTIVE', WEEKDAYS);
        let insideTx: boolean | undefined;

        await expect(
          prisma.$transaction(async (tx) => {
            // Como RE-02: la reserva nace PENDING dentro de la transacción.
            await tx.booking.create({
              data: {
                spaceId: id,
                renterId,
                startAt: MON_10,
                endAt: MON_11,
                unit: 'HOUR',
                subtotal: 12000,
                fee: 1200,
                total: 13200,
                expiresAt: new Date(Date.now() + 30 * 60_000),
              },
            });
            insideTx = await availability.isAvailable(id, MON_10, MON_11, { tx });
            throw new Error('deshacer');
          }),
        ).rejects.toThrow('deshacer');

        expect(insideTx).toBe(false);
        // La transacción se deshizo: el horario vuelve a estar libre.
        await expect(availability.isAvailable(id, MON_10, MON_11)).resolves.toBe(true);
      });
    });
  });

  // RE-02 ya está implementado: los datos válidos pasan la validación y llegan al servicio. La lógica se prueba en
  // booking-create.e2e-spec.ts; aquí solo se comprueba que la forma del contrato llega bien.
  describe('reservas (RE-02)', () => {
    it.each([
      ['por hora', VALID_BOOKING],
      // Sin milisegundos también es una hora cerrada en UTC.
      ['por día', { ...VALID_BOOKING, startAt: at(0, 9).replace('.000Z', 'Z'), endAt: at(0, 21).replace('.000Z', 'Z'), unit: 'DAY' }],
    ])('POST /api/bookings %s a un espacio que no existe responde 404', (_name, body) => {
      return request(server()).post('/api/bookings').set(auth()).send(body).expect(404);
    });

    it.each(['/api/bookings/me', '/api/bookings/me?page=2&pageSize=50'])('GET %s responde 200 con la página', async (path) => {
      const { body } = await request(server()).get(path).set(auth()).expect(200);

      expect(Object.keys(body as object).sort()).toEqual(['items', 'page', 'pageSize', 'total']);
    });

    it('GET /api/bookings/:id de una reserva que no existe responde 404', () => {
      return request(server()).get(`/api/bookings/${BOOKING}`).set(auth()).expect(404);
    });
  });

  // Los datos válidos del contrato pasan la validación y llegan al servicio, que todavía no existe (501).
  // Cada historia cambia su línea por tests de verdad.
  describe('pendiente de implementar', () => {
    it.each([
      ['get', '/api/payments/me?page=1&pageSize=10', undefined],
    ] as const)('%s %s responde 501 con datos válidos', (method, path, body) => {
      return request(server())[method](path).set(auth()).send(body).expect(501);
    });

    it('el webhook con firma llega al servicio (501)', () => {
      return request(server())
        .post('/api/payments/webhook')
        .set('stripe-signature', 't=1,v1=firma')
        .send({ id: 'evt_1', type: 'checkout.session.completed' })
        .expect(501);
    });
  });
});
