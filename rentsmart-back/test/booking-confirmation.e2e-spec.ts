import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import Stripe from 'stripe';
import { App } from 'supertest/types';
import { BookingConfirmationService, SPACE_UNAVAILABLE_REASON } from '../src/bookings/booking-confirmation.service';
import { BookingStatus, SpaceStatus } from '../src/generated/prisma/enums';
import { PAYMENT_REFUNDER } from '../src/payments/payment-refunder';
import { STRIPE_CLIENT } from '../src/payments/stripe.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// RE-04: la validación automática contra la base de test, con cuerpos firmados de verdad y `PAYMENT_REFUNDER`
// reemplazado por un doble. Firmar no usa la red y el doble de Stripe solo tiene `webhooks`: nada llama a Stripe.
// El barrido de las `PAID` atascadas está en `booking-expiry.e2e-spec.ts`, con el reloj aislado de ese archivo.
const SUFFIX = `e2e-re04-${Date.now()}`;
const WEBHOOK_SECRET = 'whsec_secreto_falso_solo_para_e2e';
const DETAIL = 'Oficina 402, citófono 12';
const TOTAL = 26400;
const at = bookingWeek(9);

describe('Confirmar una reserva pagada (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let confirmation: BookingConfirmationService;
  let ownerId: string;
  let renterId: string;
  let spaceId: string;
  let nextDay = 0;
  const refunder = { refundBooking: jest.fn<Promise<void>, [string, number, string]>() };

  const server = () => app.getHttpServer();

  /** Una reserva en un día de semana propio, con su pago y su sesión de Stripe. */
  const bookingWithPayment = async (
    status: BookingStatus = 'PENDING',
    range: { startHour: number; endHour: number; unit: 'HOUR' | 'DAY' } = { startHour: 10, endHour: 12, unit: 'HOUR' },
  ) => {
    const day = nextDay++;
    const sessionId = `cs_test_${SUFFIX}_${day}`;
    const paid = status !== 'PENDING';
    const booking = await prisma.booking.create({
      data: {
        spaceId,
        renterId,
        startAt: new Date(at(day, range.startHour)),
        endAt: new Date(at(day, range.endHour)),
        unit: range.unit,
        subtotal: 24000,
        fee: 2400,
        total: TOTAL,
        status,
        expiresAt: new Date(at(day, 9)),
        stripeCheckoutSessionId: sessionId,
      },
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripeSessionId: sessionId,
        stripePaymentIntentId: paid ? `pi_test_${sessionId}` : null,
        amount: TOTAL,
        fee: 2400,
        status: paid ? 'SUCCEEDED' : 'PENDING',
      },
    });
    return { bookingId: booking.id, sessionId };
  };

  const completed = (sessionId: string) => {
    const body = JSON.stringify({
      id: `evt_test_${SUFFIX}_${sessionId}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          payment_intent: `pi_test_${sessionId}`,
        },
      },
    });
    return request(server())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }))
      .send(body);
  };

  const read = async (bookingId: string) => {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { payment: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    return { status: booking.status, payment: booking.payment!, events: booking.events };
  };
  const setSpaceStatus = (status: SpaceStatus) => prisma.space.update({ where: { id: spaceId }, data: { status } });

  /** Corre `work` con otro horario semanal y siempre deja el de antes, aunque `work` falle. */
  const withSchedule = async (startTime: string, endTime: string, work: () => Promise<void>) => {
    const saved = await prisma.availabilityRule.findMany({ where: { spaceId } });
    try {
      await prisma.availabilityRule.deleteMany({ where: { spaceId } });
      await prisma.availabilityRule.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ spaceId, weekday, startTime, endTime })),
      });
      await work();
    } finally {
      await prisma.availabilityRule.deleteMany({ where: { spaceId } });
      await prisma.availabilityRule.createMany({
        data: saved.map(({ weekday, startTime: start, endTime: end }) => ({ spaceId, weekday, startTime: start, endTime: end })),
      });
    }
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
    confirmation = app.get(BookingConfirmationService);
    // test/utils/setup-env.ts deja el secreto vacío: aquí se pone uno falso, sin depender del .env.
    const config = app.get(ConfigService);
    const realGet = config.get.bind(config) as (...args: unknown[]) => unknown;
    jest
      .spyOn(config, 'get')
      .mockImplementation((...args: unknown[]) =>
        args[0] === 'STRIPE_WEBHOOK_SECRET' ? WEBHOOK_SECRET : realGet(...args),
      );

    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    spaceId = (
      await prisma.space.create({
        data: {
          ownerId,
          name: `Sala ${SUFFIX}`,
          status: 'ACTIVE',
          address: 'Alameda 123',
          addressDetail: DETAIL,
          pricePerHour: 12000,
          // Todos los días de 09:00 a 21:00: las reservas de este archivo caen dentro del horario.
          rulesWeek: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' })),
          },
        },
      })
    ).id;
  });

  beforeEach(async () => {
    refunder.refundBooking.mockReset();
    refunder.refundBooking.mockResolvedValue(undefined);
    await setSpaceStatus('ACTIVE');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.payment.deleteMany({ where: { booking: { spaceId } } });
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } });
    await app.close();
  });

  it('webhook completed: PENDING → PAID → CONFIRMED, con el evento de cada paso y actor nulo', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();

    await completed(sessionId).expect(200, { received: true });

    const after = await read(bookingId);
    expect(after.status).toBe('CONFIRMED');
    expect(after.payment.status).toBe('SUCCEEDED');
    expect(after.events).toEqual([
      expect.objectContaining({ fromStatus: 'PENDING', toStatus: 'PAID', actorId: null }),
      expect.objectContaining({ fromStatus: 'PAID', toStatus: 'CONFIRMED', actorId: null }),
    ]);
    expect(refunder.refundBooking).not.toHaveBeenCalled();
  });

  it('el arrendatario ve addressDetail recién en CONFIRMED (P-09) y el propietario ve la reserva confirmada', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();
    const view = () => request(server()).get(`/api/bookings/${bookingId}`).set(bearer(app, renterId)).expect(200);

    const before = await view();
    expect(before.body.status).toBe('PENDING');
    expect(before.body.space.addressDetail).toBeNull();

    // Solo el paso a PAID, con la validación apagada, para mirar ese estado intermedio.
    const held = jest.spyOn(confirmation, 'confirm').mockResolvedValueOnce('skipped');
    await completed(sessionId).expect(200);
    const paid = await view();
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.space.addressDetail).toBeNull();
    held.mockRestore();

    await completed(sessionId).expect(200);
    const confirmed = await view();
    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(confirmed.body.space.addressDetail).toBe(DETAIL);

    const { body: panel } = await request(server())
      .get('/api/owner/bookings?status=CONFIRMED&pageSize=50')
      .set(bearer(app, ownerId))
      .expect(200);
    const row = (panel.items as { id: string; status: string; subtotal: number }[]).find((item) => item.id === bookingId);
    // Aviso de B en #41: el panel usa `subtotal` sin comisión, y CONFIRMED cuenta como ingreso.
    expect(row).toMatchObject({ status: 'CONFIRMED', subtotal: 24000 });
  });

  it.each(['INACTIVE', 'BLOCKED'] as const)(
    'espacio %s: CANCELLED con motivo «Sistema: …» y reembolso del total, sin detalle de la dirección',
    async (status) => {
      const { bookingId, sessionId } = await bookingWithPayment();
      await setSpaceStatus(status);

      await completed(sessionId).expect(200);

      const after = await read(bookingId);
      expect(after.status).toBe('CANCELLED');
      expect(after.events).toEqual([
        expect.objectContaining({ toStatus: 'PAID', actorId: null }),
        expect.objectContaining({
          fromStatus: 'PAID',
          toStatus: 'CANCELLED',
          actorId: null,
          reason: SPACE_UNAVAILABLE_REASON,
        }),
      ]);
      expect(after.events[1].reason).toMatch(/^Sistema: /);
      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
      expect(refunder.refundBooking).toHaveBeenCalledWith(bookingId, TOTAL, expect.stringMatching(/^Sistema: /));

      const { body } = await request(server()).get(`/api/bookings/${bookingId}`).set(bearer(app, renterId)).expect(200);
      expect(body.status).toBe('CANCELLED');
      expect(body.space.addressDetail).toBeNull();
    },
  );

  // Enmienda a P-06: el horario semanal solo afecta a reservas nuevas. El traslape con otra reserva no se puede armar
  // aquí, porque `booking_no_overlap` lo impide en la base: lo cubre booking-confirmation.service.spec.ts.
  describe('el horario semanal cambió durante el pago', () => {
    const expectConfirmedWithoutRefund = async (bookingId: string) => {
      const after = await read(bookingId);
      expect(after.status).toBe('CONFIRMED');
      expect(after.events).toEqual([expect.objectContaining({ toStatus: 'CONFIRMED', actorId: null })]);
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    };

    it('por día: al ampliarlo, el rango ya no es el día completo, y se confirma igual', async () => {
      const { bookingId } = await bookingWithPayment('PAID', { startHour: 9, endHour: 21, unit: 'DAY' });

      await withSchedule('08:00', '22:00', async () => {
        await confirmation.confirm(bookingId);
      });

      await expectConfirmedWithoutRefund(bookingId);
    });

    it('por hora: al reducirlo y dejar el rango fuera, se confirma igual', async () => {
      const { bookingId } = await bookingWithPayment('PAID');

      await withSchedule('18:00', '19:00', async () => {
        await confirmation.confirm(bookingId);
      });

      await expectConfirmedWithoutRefund(bookingId);
    });
  });

  it('una reserva ya empezada que no ha terminado se confirma: se reservó antes del inicio y se pagó después', async () => {
    const { bookingId } = await bookingWithPayment('PAID');
    const { startAt } = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await confirmation.confirm(bookingId, new Date(startAt.getTime() + 2 * 60_000));

    expect((await read(bookingId)).status).toBe('CONFIRMED');
  });

  it('una reserva que ya terminó se cancela con reembolso', async () => {
    const { bookingId } = await bookingWithPayment('PAID');
    const { endAt } = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await confirmation.confirm(bookingId, endAt);

    expect((await read(bookingId)).status).toBe('CANCELLED');
    expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
  });

  it('si el reembolso falla, queda CANCELLED con un solo evento y el webhook responde 200', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();
    await setSpaceStatus('INACTIVE');
    refunder.refundBooking.mockRejectedValueOnce(new Error('detalle interno del proveedor'));

    await completed(sessionId).expect(200);

    const after = await read(bookingId);
    expect(after.status).toBe('CANCELLED');
    expect(after.events.filter((event) => event.toStatus === 'CANCELLED')).toHaveLength(1);
    expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
  });

  // Una transacción del test retiene el lock del espacio hasta que Postgres dice que las dos llamadas lo están esperando,
  // sin depender de tiempos. Al soltarlo pasan una tras otra, y la segunda ve lo que dejó la primera.
  describe('dos confirm que esperan el mismo lock', () => {
    const racing = async (bookingId: string) => {
      let calls: Promise<string[]> | undefined;
      await prisma.$transaction(
        async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${spaceId}, 0))`;
          calls = Promise.all([confirmation.confirm(bookingId), confirmation.confirm(bookingId)]);
          for (;;) {
            const [{ blocked }] = await prisma.$queryRaw<{ blocked: bigint }[]>`
              SELECT count(*) AS blocked FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
            if (blocked >= 2n) break;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        },
        { timeout: 15_000 },
      );
      return calls!;
    };

    it('al confirmar dejan un solo evento', async () => {
      const { bookingId } = await bookingWithPayment('PAID');

      const outcomes = await racing(bookingId);

      expect(outcomes.sort()).toEqual(['confirmed', 'skipped']);
      const after = await read(bookingId);
      expect(after.status).toBe('CONFIRMED');
      expect(after.events).toHaveLength(1);
      expect(refunder.refundBooking).not.toHaveBeenCalled();
    });

    it('al cancelar dejan un solo evento y un solo reembolso', async () => {
      const { bookingId } = await bookingWithPayment('PAID');
      await setSpaceStatus('INACTIVE');

      const outcomes = await racing(bookingId);

      expect(outcomes.sort()).toEqual(['cancelled', 'skipped']);
      const after = await read(bookingId);
      expect(after.status).toBe('CANCELLED');
      expect(after.events).toHaveLength(1);
      expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
    });
  });

  it('un evento repetido sobre una CONFIRMED no cambia nada', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();
    await completed(sessionId).expect(200);
    const first = await read(bookingId);
    expect(first.status).toBe('CONFIRMED');

    await completed(sessionId).expect(200, { received: true });

    const after = await read(bookingId);
    expect(after.status).toBe('CONFIRMED');
    expect(after.events).toHaveLength(first.events.length);
    expect(after.payment.status).toBe('SUCCEEDED');
    expect(refunder.refundBooking).not.toHaveBeenCalled();
  });

  it('un evento repetido sobre la que RE-04 canceló no vuelve a pedir el reembolso', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();
    await setSpaceStatus('INACTIVE');
    await completed(sessionId).expect(200);
    expect(refunder.refundBooking).toHaveBeenCalledTimes(1);

    await completed(sessionId).expect(200);

    expect((await read(bookingId)).status).toBe('CANCELLED');
    expect(refunder.refundBooking).toHaveBeenCalledTimes(1);
  });

  it('un fallo inesperado de la base deja la reserva PAID, y el reenvío del evento la confirma', async () => {
    const { bookingId, sessionId } = await bookingWithPayment();
    type TransactionCallback = (tx: object) => Promise<unknown>;
    const client = prisma as unknown as { $transaction: (callback: TransactionCallback) => Promise<unknown> };
    const real = confirmation.confirm.bind(confirmation);
    const realTransaction = client.$transaction.bind(client);
    const failingSpace = { findUnique: () => Promise.reject(new Error('se cayó la base')) };
    // La transacción de `markPaid` (la primera) pasa tal cual; falla solo la de `confirm`, al leer el espacio.
    const spy = jest.spyOn(confirmation, 'confirm').mockImplementationOnce(async (id) => {
      const transaction = jest.spyOn(client, '$transaction').mockImplementationOnce((callback) =>
        realTransaction((tx) =>
          callback(new Proxy(tx, { get: (t, key) => (key === 'space' ? failingSpace : Reflect.get(t, key)) })),
        ),
      );
      try {
        return await real(id);
      } finally {
        transaction.mockRestore();
      }
    });

    await completed(sessionId).expect(200);

    spy.mockRestore();
    const stuck = await read(bookingId);
    expect(stuck.status).toBe('PAID');
    expect(stuck.events).toHaveLength(1);
    expect(refunder.refundBooking).not.toHaveBeenCalled();

    await completed(sessionId).expect(200);

    expect((await read(bookingId)).status).toBe('CONFIRMED');
  });
});
