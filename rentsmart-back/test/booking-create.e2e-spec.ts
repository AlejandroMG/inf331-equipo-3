import { BadGatewayException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { BookingsService } from '../src/bookings/bookings.service';
import { CHECKOUT_GATEWAY, type CheckoutGateway } from '../src/payments/checkout-gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// RE-02: reservar, mis reservas y ver una reserva, contra la base de test. Las fechas se calculan desde hoy con
// `bookingWeek` (la semana que empieza el lunes a 4 semanas, en la hora de Chile), así nunca quedan en el pasado.
// Donde importa la hora exacta (el vencimiento de la retención) se llama al servicio con un reloj fijo, como en DI-02.
const SUFFIX = `e2e-re02-${Date.now()}`;
const MINUTE = 60_000;
const WEEKDAYS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' }));
/** `at(0, 10)` es el lunes de esa semana a las 10:00 de Chile; `at(-1, …)` el domingo anterior, que no se arrienda. */
const at = bookingWeek();
/** Un lunes que ya pasó. */
const past = bookingWeek(-4);

interface BookingBody {
  id: string;
  status: string;
  unit: string;
  startAt: string;
  endAt: string;
  subtotal: number;
  fee: number;
  total: number;
  expiresAt: string | null;
  createdAt: string;
  space: Record<string, unknown>;
}

describe('Reservar un espacio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let otherId: string;
  const spaceIds: string[] = [];

  const server = () => app.getHttpServer();
  const book = (userId: string, body: object) => request(server()).post('/api/bookings').set(bearer(app, userId)).send(body);
  const hourly = (spaceId: string, startAt: string, endAt: string) => ({ spaceId, startAt, endAt, unit: 'HOUR' });

  let counter = 0;
  const space = async (extra: { status?: 'ACTIVE' | 'INACTIVE'; pricePerHour?: number | null; pricePerDay?: number | null } = {}) => {
    counter += 1;
    const created = await prisma.space.create({
      data: {
        ownerId,
        name: `Sala ${counter} ${SUFFIX}`,
        status: extra.status ?? 'ACTIVE',
        address: 'Alameda 123',
        addressDetail: 'Oficina 402',
        pricePerHour: extra.pricePerHour === undefined ? 12000 : extra.pricePerHour,
        pricePerDay: extra.pricePerDay === undefined ? 90000 : extra.pricePerDay,
        rulesWeek: { create: WEEKDAYS },
      },
    });
    spaceIds.push(created.id);
    return created.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    otherId = (await user('other')).id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { booking: { spaceId: { in: spaceIds } } } });
    await prisma.booking.deleteMany({ where: { spaceId: { in: spaceIds } } });
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId, otherId] } } });
    await app.close();
  });

  describe('POST /api/bookings', () => {
    it('por hora: crea la reserva PENDING con el desglose y su evento, y entrega a dónde ir a pagar', async () => {
      const id = await space();
      const before = Date.now();

      // Lunes de 10:00 a 12:00 en Chile.
      const { body } = await book(renterId, hourly(id, at(0, 10), at(0, 12))).expect(201);

      const { bookingId, checkoutUrl } = body as { bookingId: string; checkoutUrl: string };
      expect(Object.keys(body as object).sort()).toEqual(['bookingId', 'checkoutUrl']);
      // Sin STRIPE_SECRET_KEY (los e2e la quitan), el checkout lleva a la página de la reserva en el front.
      expect(checkoutUrl).toMatch(new RegExp(`^https?://.+/bookings/${bookingId}$`));

      const stored = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(stored).toMatchObject({
        spaceId: id,
        renterId,
        status: 'PENDING',
        unit: 'HOUR',
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        stripeCheckoutSessionId: null,
      });
      // Retiene el horario 31 minutos desde que se creó (P-06).
      expect(stored.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 31 * MINUTE);
      expect(stored.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 31 * MINUTE);
      // Sin Stripe no hay sesión de pago, así que tampoco hay Payment.
      expect(await prisma.payment.count({ where: { bookingId } })).toBe(0);

      const events = await prisma.bookingEvent.findMany({ where: { bookingId } });
      expect(events).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'PENDING', actorId: renterId })]);
    });

    it('por día: cobra el precio por día por el día completo', async () => {
      const id = await space();
      // El martes se arrienda de 09:00 a 21:00 en Chile.
      const body = { spaceId: id, startAt: at(1, 9), endAt: at(1, 21), unit: 'DAY' };

      const { body: created } = await book(renterId, body).expect(201);

      const stored = await prisma.booking.findUniqueOrThrow({ where: { id: (created as { bookingId: string }).bookingId } });
      expect(stored).toMatchObject({ unit: 'DAY', subtotal: 90000, fee: 9000, total: 99000, status: 'PENDING' });
    });

    it('con un reloj fijo, la retención vence exactamente 31 minutos después', async () => {
      const id = await space();
      // El domingo anterior a las 12:07 de Chile.
      const now = new Date(Date.parse(at(-1, 12)) + 7 * MINUTE);

      const { bookingId } = await app
        .get(BookingsService)
        .create(renterId, hourly(id, at(0, 10), at(0, 11)) as never, now);

      const stored = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(stored.expiresAt).toEqual(new Date(now.getTime() + 31 * MINUTE));
    });

    it('con una sesión de Stripe, guarda su id en la reserva y registra el pago PENDING con los montos (PA-01)', async () => {
      const id = await space();
      // Un checkout que se comporta como Stripe (devuelve un id de sesión), sin llamar a Stripe.
      const gateway = app.get<CheckoutGateway>(CHECKOUT_GATEWAY);
      const stripeLike = jest.spyOn(gateway, 'createSession').mockImplementationOnce((booking) =>
        Promise.resolve({ url: `https://checkout.stripe.test/c/pay/cs_test_${booking.id}`, sessionId: `cs_test_${booking.id}` }),
      );

      let bookingId: string;
      try {
        const { body } = await book(renterId, hourly(id, at(0, 10), at(0, 12))).expect(201);
        ({ bookingId } = body as { bookingId: string });
        expect((body as { checkoutUrl: string }).checkoutUrl).toBe(`https://checkout.stripe.test/c/pay/cs_test_${bookingId}`);
      } finally {
        stripeLike.mockRestore();
      }

      const stored = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(stored.stripeCheckoutSessionId).toBe(`cs_test_${bookingId}`);
      const payment = await prisma.payment.findUniqueOrThrow({ where: { bookingId } });
      expect(payment).toMatchObject({
        stripeSessionId: `cs_test_${bookingId}`,
        stripePaymentIntentId: null,
        amount: 26400,
        fee: 2400,
        refundedAmount: 0,
        status: 'PENDING',
      });
    });

    it('si Stripe falla responde 502 con un mensaje claro, y no queda nada (PA-01)', async () => {
      const id = await space();
      const gateway = app.get<CheckoutGateway>(CHECKOUT_GATEWAY);
      const failing = jest
        .spyOn(gateway, 'createSession')
        .mockRejectedValueOnce(new BadGatewayException('No pudimos iniciar el pago con Stripe; intenta de nuevo'));

      try {
        const { body } = await book(renterId, hourly(id, at(0, 10), at(0, 11))).expect(502);
        expect(body).toMatchObject({ message: 'No pudimos iniciar el pago con Stripe; intenta de nuevo' });
      } finally {
        failing.mockRestore();
      }

      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(0);
    });

    it('si el checkout falla, no queda la reserva ni su evento: la transacción se deshace', async () => {
      const id = await space();
      // Se sobrescribe el gateway que registra CheckoutModule, solo para esta llamada.
      const gateway = app.get<CheckoutGateway>(CHECKOUT_GATEWAY);
      const failing = jest.spyOn(gateway, 'createSession').mockRejectedValueOnce(new Error('Stripe no responde'));

      try {
        await book(renterId, hourly(id, at(0, 10), at(0, 11))).expect(500);
        expect(failing).toHaveBeenCalledTimes(1);
      } finally {
        failing.mockRestore();
      }

      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(0);
      expect(await prisma.bookingEvent.count({ where: { booking: { spaceId: id } } })).toBe(0);
      // El horario sigue libre: se puede reservar de nuevo.
      await book(renterId, hourly(id, at(0, 10), at(0, 11))).expect(201);
    });

    it('responde 409 si se traslapa con otra reserva PENDING vigente, y no crea nada', async () => {
      const id = await space();
      await book(renterId, hourly(id, at(0, 10), at(0, 12))).expect(201);

      const { body } = await book(otherId, hourly(id, at(0, 11), at(0, 13))).expect(409);

      expect(body).toMatchObject({ statusCode: 409 });
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(1);
      // Justo después de la otra (rangos semiabiertos) sí se puede.
      await book(otherId, hourly(id, at(0, 12), at(0, 13))).expect(201);
    });

    it('si la PENDING previa ya venció, reserva el mismo horario y la vencida queda EXPIRED con su evento', async () => {
      const id = await space();
      const stale = await prisma.booking.create({
        data: {
          spaceId: id,
          renterId: otherId,
          startAt: new Date(at(0, 10)),
          endAt: new Date(at(0, 12)),
          unit: 'HOUR',
          subtotal: 24000,
          fee: 2400,
          total: 26400,
          expiresAt: new Date(Date.now() - MINUTE),
        },
      });

      // Sin pasarla antes a EXPIRED, booking_no_overlap rechazaría la nueva.
      await book(renterId, hourly(id, at(0, 10), at(0, 12))).expect(201);

      const expired = await prisma.booking.findUniqueOrThrow({ where: { id: stale.id } });
      expect(expired.status).toBe('EXPIRED');
      const events = await prisma.bookingEvent.findMany({ where: { bookingId: stale.id } });
      expect(events).toEqual([expect.objectContaining({ fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null })]);
    });

    it('responde 409 fuera del horario semanal', async () => {
      const id = await space();

      // El domingo no se arrienda.
      await book(renterId, hourly(id, at(-1, 10), at(-1, 11))).expect(409);
    });

    it.each([
      ['por hora a un espacio sin precio por hora', { pricePerHour: null }, 'HOUR', 'Este espacio no se arrienda por hora'],
      ['por día a un espacio sin precio por día', { pricePerDay: null }, 'DAY', 'Este espacio no se arrienda por día'],
    ])('responde 400 al reservar %s', async (_name, prices, unit, message) => {
      const id = await space(prices);
      const body = { spaceId: id, startAt: at(1, 9), endAt: at(1, 21), unit };

      const { body: error } = await book(renterId, body).expect(400);

      expect(error).toMatchObject({ message });
    });

    it('responde 400 si el horario ya pasó, el fin no es posterior al inicio o el rango supera 31 días', async () => {
      const id = await space();

      await book(renterId, hourly(id, past(0, 10), past(0, 11))).expect(400);
      await book(renterId, hourly(id, at(0, 12), at(0, 10))).expect(400);
      await book(renterId, hourly(id, at(0, 10), at(0, 10))).expect(400);
      const { body } = await book(renterId, hourly(id, at(0, 10), at(32, 10))).expect(400);
      expect(body).toMatchObject({ message: 'Una reserva no puede durar más de 31 días' });
    });

    it('responde 400 si el total supera lo que acepta Stripe (99 999 999 CLP), y no crea nada (PA-01)', async () => {
      // 1 hora: subtotal 90.909.091 y comisión 9.090.909 suman 100.000.000.
      const id = await space({ pricePerHour: 90_909_091 });

      const { body } = await book(renterId, hourly(id, at(0, 10), at(0, 11))).expect(400);

      expect(body).toMatchObject({
        message: 'El total de la reserva supera el máximo que se puede pagar en línea (99999999 CLP); elige menos horas',
      });
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(0);
    });

    it('responde 403 si el dueño reserva su propio espacio', async () => {
      const id = await space();

      await book(ownerId, hourly(id, at(0, 10), at(0, 11))).expect(403);
      expect(await prisma.booking.count({ where: { spaceId: id } })).toBe(0);
    });

    it('responde 404 si el espacio no existe o no está activo', async () => {
      const inactive = await space({ status: 'INACTIVE' });

      await book(renterId, hourly('no-existe', at(0, 10), at(0, 11))).expect(404);
      await book(renterId, hourly(inactive, at(0, 10), at(0, 11))).expect(404);
    });
  });

  describe('GET /api/bookings/me y /api/bookings/:id', () => {
    let pageUserId: string;
    const created: string[] = [];

    beforeAll(async () => {
      pageUserId = (
        await prisma.user.create({
          data: { email: `pages-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: 'Páginas' },
        })
      ).id;
      const id = await space();
      // Tres reservas, una tras otra, de lunes a miércoles: la más reciente es la del miércoles.
      for (const day of [0, 1, 2]) {
        const { body } = await book(pageUserId, hourly(id, at(day, 10), at(day, 11))).expect(201);
        created.push((body as { bookingId: string }).bookingId);
      }
    });

    afterAll(async () => {
      await prisma.booking.deleteMany({ where: { renterId: pageUserId } });
      await prisma.user.delete({ where: { id: pageUserId } });
    });

    it('lista mis reservas paginadas, las más recientes primero', async () => {
      const first = await request(server()).get('/api/bookings/me?page=1&pageSize=2').set(bearer(app, pageUserId)).expect(200);
      const second = await request(server()).get('/api/bookings/me?page=2&pageSize=2').set(bearer(app, pageUserId)).expect(200);

      const page1 = first.body as { items: BookingBody[]; total: number; page: number; pageSize: number };
      const page2 = second.body as { items: BookingBody[]; total: number; page: number; pageSize: number };
      expect(page1).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(page1.items.map((item) => item.id)).toEqual([created[2], created[1]]);
      expect(page2.items.map((item) => item.id)).toEqual([created[0]]);
    });

    it('no muestra las reservas de otros', async () => {
      const { body } = await request(server()).get('/api/bookings/me').set(bearer(app, otherId)).expect(200);

      const ids = (body as { items: BookingBody[] }).items.map((item) => item.id);
      for (const id of created) expect(ids).not.toContain(id);
    });

    it('GET /:id devuelve mi reserva con el desglose y sin el detalle privado mientras no esté confirmada', async () => {
      const { body } = await request(server()).get(`/api/bookings/${created[0]}`).set(bearer(app, pageUserId)).expect(200);

      const booking = body as BookingBody;
      expect(booking).toMatchObject({
        id: created[0],
        status: 'PENDING',
        unit: 'HOUR',
        startAt: at(0, 10),
        endAt: at(0, 11),
        subtotal: 12000,
        fee: 1200,
        total: 13200,
      });
      expect(booking.expiresAt).not.toBeNull();
      expect(booking.space).toMatchObject({ address: 'Alameda 123', addressDetail: null, coverUrl: null });
    });

    it('GET /:id responde 403 si la reserva es de otro usuario, también al dueño del espacio', async () => {
      await request(server()).get(`/api/bookings/${created[0]}`).set(bearer(app, otherId)).expect(403);
      await request(server()).get(`/api/bookings/${created[0]}`).set(bearer(app, ownerId)).expect(403);
    });

    it('GET /:id responde 404 si la reserva no existe', async () => {
      await request(server()).get('/api/bookings/no-existe').set(bearer(app, pageUserId)).expect(404);
    });
  });
});
