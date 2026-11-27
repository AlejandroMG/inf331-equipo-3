import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import Stripe from 'stripe';
import { App } from 'supertest/types';
import { BookingConfirmationService } from '../src/bookings/booking-confirmation.service';
import { BookingStateService } from '../src/bookings/booking-state.service';
import { BookingStatus, PaymentStatus } from '../src/generated/prisma/enums';
import { PAYMENT_REFUNDER } from '../src/payments/payment-refunder';
import { STRIPE_CLIENT } from '../src/payments/stripe.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// PA-02: POST /api/payments/webhook contra la base de test, con cuerpos firmados de verdad. Firmar y verificar no usan
// la red, y el doble del cliente de Stripe solo tiene `webhooks`, así que este archivo no puede llamar a Stripe.
const SUFFIX = `e2e-pa02-${Date.now()}`;
const WEBHOOK_SECRET = 'whsec_secreto_falso_solo_para_e2e';
const at = bookingWeek(8);

describe('Webhook de Stripe (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let spaceId: string;
  let configuredSecret: string;
  let nextDay = 0;
  let nextEvent = 0;
  const refunder = { refundBooking: jest.fn<Promise<void>, [string, number, string]>() };

  /** Una reserva en un día propio, con su pago pendiente y su sesión de Stripe. */
  const bookingWithPayment = async (
    status: BookingStatus = 'PENDING',
    paymentStatus: PaymentStatus = 'PENDING',
  ) => {
    const day = nextDay++;
    const sessionId = `cs_test_${SUFFIX}_${day}`;
    const booking = await prisma.booking.create({
      data: {
        spaceId,
        renterId,
        startAt: new Date(at(day, 10)),
        endAt: new Date(at(day, 12)),
        unit: 'HOUR',
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        status,
        expiresAt: new Date(at(day, 9)),
        stripeCheckoutSessionId: sessionId,
      },
    });
    await prisma.payment.create({
      data: { bookingId: booking.id, stripeSessionId: sessionId, amount: 26400, fee: 2400, status: paymentStatus },
    });
    return { bookingId: booking.id, sessionId };
  };

  const eventBody = (type: string, session: Record<string, unknown>) =>
    JSON.stringify({ id: `evt_test_${SUFFIX}_${nextEvent++}`, object: 'event', type, data: { object: session } });

  const post = (body: string, signature: string) =>
    request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(body);

  const signed = (body: string) =>
    post(body, Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }));

  const completedBody = (sessionId: string, extra: Record<string, unknown> = {}) =>
    eventBody('checkout.session.completed', {
      id: sessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      payment_intent: `pi_test_${sessionId}`,
      ...extra,
    });
  const expiredBody = (sessionId: string) =>
    eventBody('checkout.session.expired', { id: sessionId, object: 'checkout.session', payment_status: 'unpaid' });

  const read = async (bookingId: string) => {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { payment: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    return { status: booking.status, payment: booking.payment!, events: booking.events };
  };

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(STRIPE_CLIENT)
        .useValue({ webhooks: Stripe.webhooks })
        .overrideProvider(PAYMENT_REFUNDER)
        .useValue(refunder),
    );
    prisma = app.get(PrismaService);
    // test/utils/setup-env.ts deja el secreto vacío: aquí se pone uno falso, sin depender del .env.
    const config = app.get(ConfigService);
    const realGet = config.get.bind(config) as (...args: unknown[]) => unknown;
    jest
      .spyOn(config, 'get')
      .mockImplementation((...args: unknown[]) =>
        args[0] === 'STRIPE_WEBHOOK_SECRET' ? configuredSecret : realGet(...args),
      );

    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    spaceId = (
      await prisma.space.create({
        data: { ownerId, name: `Sala ${SUFFIX}`, status: 'ACTIVE', address: 'Alameda 123', pricePerHour: 12000 },
      })
    ).id;
  });

  beforeEach(() => {
    configuredSecret = WEBHOOK_SECRET;
    refunder.refundBooking.mockReset();
    refunder.refundBooking.mockResolvedValue(undefined);
    // Este archivo prueba el webhook hasta `PAID`; la validación real (RE-04) está en booking-confirmation.e2e-spec.ts.
    jest.spyOn(app.get(BookingConfirmationService), 'confirm').mockClear().mockResolvedValue('skipped');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.payment.deleteMany({ where: { booking: { spaceId } } });
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } });
    await app.close();
  });

  describe('firma y configuración', () => {
    it('con una firma inválida responde 400 y nada cambia', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const body = completedBody(sessionId);
      const wrong = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_otro_secreto_falso' });

      await post(body, wrong).expect(400);

      const after = await read(bookingId);
      expect(after.status).toBe('PENDING');
      expect(after.payment.status).toBe('PENDING');
      expect(after.events).toHaveLength(0);
    });

    it('con un cuerpo distinto del firmado responde 400', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const header = Stripe.webhooks.generateTestHeaderString({
        payload: completedBody(sessionId),
        secret: WEBHOOK_SECRET,
      });

      await post(completedBody(sessionId, { payment_intent: 'pi_test_alterado' }), header).expect(400);

      expect((await read(bookingId)).status).toBe('PENDING');
    });

    it('sin el secreto responde 503 con un mensaje sin detalles', async () => {
      configuredSecret = '';
      const { bookingId, sessionId } = await bookingWithPayment();

      const { body } = await signed(completedBody(sessionId)).expect(503);

      expect(JSON.stringify(body)).not.toMatch(/whsec|STRIPE_/);
      expect((await read(bookingId)).status).toBe('PENDING');
    });

    it('un tipo de evento que no interesa responde 200', async () => {
      await signed(eventBody('customer.created', { id: 'cus_test_falso' })).expect(200, { received: true });
    });

    it('no queda limitado por el throttler de auth', async () => {
      const body = eventBody('customer.created', { id: 'cus_test_falso' });
      // El límite de login es de 10 solicitudes; se pasa de largo.
      for (let i = 0; i < 12; i++) {
        await signed(body).expect(200);
      }
    });
  });

  describe('checkout.session.completed', () => {
    it('pasa una PENDING a PAID, guarda el pago y su PaymentIntent, y deja el evento con actor nulo', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const confirm = jest.spyOn(app.get(BookingConfirmationService), 'confirm');

      await signed(completedBody(sessionId)).expect(200, { received: true });

      const after = await read(bookingId);
      expect(after.status).toBe('PAID');
      expect(after.payment.status).toBe('SUCCEEDED');
      expect(after.payment.stripePaymentIntentId).toBe(`pi_test_${sessionId}`);
      expect(after.events).toEqual([
        expect.objectContaining({ fromStatus: 'PENDING', toStatus: 'PAID', actorId: null }),
      ]);
      expect(confirm).toHaveBeenCalledWith(bookingId);
      expect(refunder.refundBooking).not.toHaveBeenCalled();
      confirm.mockRestore();
    });

    it('el mismo evento dos veces deja un solo BookingEvent', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const body = completedBody(sessionId);

      await signed(body).expect(200);
      await signed(body).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('PAID');
      expect(after.events).toHaveLength(1);
    });

    it('un reenvío sobre una PAID vuelve a confirmar: repara una caída entre el COMMIT y confirm', async () => {
      const { bookingId, sessionId } = await bookingWithPayment('PAID', 'SUCCEEDED');
      const confirm = jest.spyOn(app.get(BookingConfirmationService), 'confirm');

      await signed(completedBody(sessionId)).expect(200, { received: true });

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith(bookingId);
      const after = await read(bookingId);
      expect(after.status).toBe('PAID');
      expect(after.events).toHaveLength(0);
      confirm.mockRestore();
    });

    it('si falla guardar el pago dentro de la transacción, la reserva sigue PENDING, sin evento, y Stripe puede reintentar', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const body = completedBody(sessionId);
      const confirm = jest.spyOn(app.get(BookingConfirmationService), 'confirm');
      const failingPayment = { update: () => Promise.reject(new Error('falló guardar el pago')) };
      type TransactionCallback = (tx: object) => Promise<unknown>;
      const client = prisma as unknown as { $transaction: (callback: TransactionCallback) => Promise<unknown> };
      const realTransaction = client.$transaction.bind(client);
      // La transacción es real, y el error la deshace de verdad; solo falla `tx.payment.update`, después de la transición.
      const transaction = jest.spyOn(client, '$transaction').mockImplementationOnce((callback) =>
        realTransaction((tx) =>
          callback(new Proxy(tx, { get: (t, key) => (key === 'payment' ? failingPayment : Reflect.get(t, key)) })),
        ),
      );

      await signed(body).expect(500);

      transaction.mockRestore();
      const after = await read(bookingId);
      expect(after.status).toBe('PENDING');
      expect(after.events).toHaveLength(0);
      expect(after.payment.status).toBe('PENDING');
      expect(after.payment.stripePaymentIntentId).toBeNull();
      expect(confirm).not.toHaveBeenCalled();

      await signed(body).expect(200);

      expect((await read(bookingId)).status).toBe('PAID');
      confirm.mockRestore();
    });

    it('si la confirmación falla igual responde 200: el pago ya quedó guardado', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const confirm = jest
        .spyOn(app.get(BookingConfirmationService), 'confirm')
        .mockRejectedValueOnce(new Error('falló la validación'));

      await signed(completedBody(sessionId)).expect(200);

      expect((await read(bookingId)).status).toBe('PAID');
      confirm.mockRestore();
    });

    it('decide por la sesión, no por los metadatos', async () => {
      const victim = await bookingWithPayment();
      const { bookingId, sessionId } = await bookingWithPayment();

      await signed(
        completedBody(sessionId, { metadata: { bookingId: victim.bookingId }, client_reference_id: victim.bookingId }),
      ).expect(200);

      expect((await read(bookingId)).status).toBe('PAID');
      expect((await read(victim.bookingId)).status).toBe('PENDING');
    });

    it('con payment_status distinto de paid no cambia nada', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();

      await signed(completedBody(sessionId, { payment_status: 'unpaid' })).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('PENDING');
      expect(after.payment.status).toBe('PENDING');
    });

    it('con una sesión desconocida responde 200', async () => {
      await signed(completedBody(`cs_test_${SUFFIX}_desconocida`)).expect(200, { received: true });
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it.each(['EXPIRED', 'CANCELLED'] as const)(
      'sobre una %s pide el reembolso del total y la reserva no cambia',
      async (status) => {
        const { bookingId, sessionId } = await bookingWithPayment(status);

        await signed(completedBody(sessionId)).expect(200);

        const after = await read(bookingId);
        expect(after.status).toBe(status);
        expect(after.events).toHaveLength(0);
        expect(after.payment.status).toBe('SUCCEEDED');
        expect(after.payment.stripePaymentIntentId).toBe(`pi_test_${sessionId}`);
        expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
        expect(refunder.refundBooking).toHaveBeenCalledWith(bookingId, 26400, expect.stringContaining(status));
      },
    );

    it('si el reembolso falla responde un error y el reintento lo vuelve a pedir', async () => {
      const { bookingId, sessionId } = await bookingWithPayment('EXPIRED');
      const body = completedBody(sessionId);
      refunder.refundBooking.mockRejectedValueOnce(new Error('detalle interno del proveedor'));

      const { body: failure } = await signed(body).expect(500);
      expect(JSON.stringify(failure)).not.toContain('detalle interno del proveedor');
      expect((await read(bookingId)).payment.status).toBe('SUCCEEDED');

      await signed(body).expect(200);

      expect(refunder.refundBooking).toHaveBeenCalledTimes(2);
      expect(refunder.refundBooking).toHaveBeenLastCalledWith(bookingId, 26400, expect.any(String));
    });

    it('sobre una EXPIRED con el pago FAILED registra el cobro y pide el reembolso del total', async () => {
      const { bookingId, sessionId } = await bookingWithPayment('EXPIRED', 'FAILED');

      await signed(completedBody(sessionId)).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('EXPIRED');
      expect(after.events).toHaveLength(0);
      expect(after.payment.status).toBe('SUCCEEDED');
      expect(after.payment.stripePaymentIntentId).toBe(`pi_test_${sessionId}`);
      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
      expect(refunder.refundBooking).toHaveBeenCalledWith(bookingId, 26400, expect.stringContaining('EXPIRED'));
    });

    it('con el pago ya reembolsado responde 200 sin pedir nada', async () => {
      const { sessionId } = await bookingWithPayment('EXPIRED', 'REFUNDED');

      await signed(completedBody(sessionId)).expect(200);

      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('un evento repetido sobre una reserva pagada y cancelada después no la reembolsa de nuevo', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const body = completedBody(sessionId);
      await signed(body).expect(200);
      // Así la deja una cancelación con menos de 24 horas (P-14): cancelada, con el pago vigente y sin reembolso.
      const state = app.get(BookingStateService);
      await state.transition(bookingId, 'CANCELLED', { actorId: renterId, reason: 'Ya no la necesito' });

      await signed(body).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('CANCELLED');
      expect(after.payment.status).toBe('SUCCEEDED');
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it.each(['CONFIRMED', 'FINISHED'] as const)('sobre una %s responde 200 sin hacer nada', async (status) => {
      const { bookingId, sessionId } = await bookingWithPayment(status, 'SUCCEEDED');
      const confirm = jest.spyOn(app.get(BookingConfirmationService), 'confirm');

      await signed(completedBody(sessionId)).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe(status);
      expect(after.events).toHaveLength(0);
      expect(refunder.refundBooking).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      confirm.mockRestore();
    });

    it.each(['EXPIRED', 'CANCELLED'] as const)(
      'con un cambio de estado a %s previo a la transición (sin concurrencia real), lee de nuevo y reembolsa',
      async (raced) => {
        const { bookingId, sessionId } = await bookingWithPayment();
        const state = app.get(BookingStateService);
        const realTransition = state.transition.bind(state);
        // El cambio se guarda después de que el webhook leyó PENDING y antes de que intente su transición: `transition`
        // lo ve al leer y responde 409 por `canTransition`, sin llegar a `updateManyAndReturn`.
        const transition = jest.spyOn(state, 'transition').mockImplementationOnce(async (id, to, change, tx) => {
          await prisma.booking.update({ where: { id }, data: { status: raced } });
          return realTransition(id, to, change, tx);
        });

        await signed(completedBody(sessionId)).expect(200);

        transition.mockRestore();
        const after = await read(bookingId);
        expect(after.status).toBe(raced);
        expect(after.events).toHaveLength(0);
        expect(after.payment.status).toBe('SUCCEEDED');
        expect(refunder.refundBooking).toHaveBeenCalledWith(bookingId, 26400, expect.stringContaining(raced));
      },
    );

    it('con concurrencia real: si otra transacción gana mientras el webhook espera la fila, actualiza 0 filas y reembolsa', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      let response: Promise<request.Response> | undefined;

      // La otra transacción deja la fila cambiada sin confirmar. El webhook lee PENDING y se queda esperando en
      // `updateManyAndReturn`; al confirmarla, Postgres reevalúa `status = PENDING` y no actualiza ninguna fila. No
      // depende de tiempos: confirma solo cuando Postgres dice que el webhook está bloqueado por esta transacción.
      await prisma.$transaction(
        async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          await tx.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } });
          response = signed(completedBody(sessionId)).then((result) => result);
          for (;;) {
            const [{ blocked }] = await prisma.$queryRaw<{ blocked: bigint }[]>`
              SELECT count(*) AS blocked FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
            if (blocked > 0n) break;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        },
        { timeout: 15_000 },
      );

      expect((await response!).status).toBe(200);
      const after = await read(bookingId);
      expect(after.status).toBe('EXPIRED');
      expect(after.events).toHaveLength(0);
      expect(after.payment.status).toBe('SUCCEEDED');
      expect(refunder.refundBooking).toHaveBeenCalledWith(bookingId, 26400, expect.stringContaining('EXPIRED'));
    });
  });

  describe('checkout.session.expired', () => {
    it('pasa una PENDING a EXPIRED con actor nulo y el pago a FAILED', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();

      await signed(expiredBody(sessionId)).expect(200, { received: true });

      const after = await read(bookingId);
      expect(after.status).toBe('EXPIRED');
      expect(after.payment.status).toBe('FAILED');
      expect(after.events).toEqual([
        expect.objectContaining({ fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null }),
      ]);
    });

    it('repetido deja un solo evento', async () => {
      const { bookingId, sessionId } = await bookingWithPayment();
      const body = expiredBody(sessionId);

      await signed(body).expect(200);
      await signed(body).expect(200);

      expect((await read(bookingId)).events).toHaveLength(1);
    });

    it('no toca una reserva ya PAID ni su pago', async () => {
      const { bookingId, sessionId } = await bookingWithPayment('PAID', 'SUCCEEDED');

      await signed(expiredBody(sessionId)).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('PAID');
      expect(after.payment.status).toBe('SUCCEEDED');
      expect(after.events).toHaveLength(0);
    });

    it('sobre una CANCELLED deja la reserva igual y marca el pago pendiente como FAILED', async () => {
      const { bookingId, sessionId } = await bookingWithPayment('CANCELLED');

      await signed(expiredBody(sessionId)).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('CANCELLED');
      expect(after.payment.status).toBe('FAILED');
    });

    it('con una sesión desconocida responde 200', async () => {
      await signed(expiredBody(`cs_test_${SUFFIX}_desconocida`)).expect(200, { received: true });
    });
  });
});
