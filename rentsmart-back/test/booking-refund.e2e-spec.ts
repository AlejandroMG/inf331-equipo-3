import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PAYMENT_REFUNDER } from '../src/payments/payment-refunder';
import { PaymentRefundService } from '../src/payments/payment-refund.service';
import { NoopRefundGateway, REFUND_GATEWAY, type RefundGateway } from '../src/payments/refund-gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// PA-03: cancelar y reembolsar contra la base de test. Ningún e2e llama a Stripe: sin clave el gateway es el Noop, y
// aquí se espía. El `stripePaymentIntentId` lo completaría el webhook (PA-02); estos tests lo crean directo en la base.
const SUFFIX = `e2e-pa03-${Date.now()}`;
const HOUR = 3_600_000;
const REASON = 'Se suspendió la reunión';
const TOTAL = 26400;
const at = bookingWeek(5);

describe('Reembolsar al cancelar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let gateway: RefundGateway;
  let refund: jest.SpyInstance;
  let logError: jest.SpyInstance;
  let ownerId: string;
  let renterId: string;
  let spaceId: string;

  const server = () => app.getHttpServer();
  const cancel = (bookingId: string, userId: string) =>
    request(server()).post(`/api/bookings/${bookingId}/cancel`).set(bearer(app, userId)).send({ reason: REASON });
  const statusOf = async (bookingId: string) =>
    (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;
  const paymentOf = (bookingId: string) =>
    prisma.payment.findUniqueOrThrow({
      where: { bookingId },
      select: { id: true, status: true, refundedAmount: true, stripePaymentIntentId: true },
    });

  let day = 0;
  /** Una reserva `CONFIRMED` del arrendatario, por defecto a más de 24 horas, cada una en un día distinto. */
  const confirmed = async (startAt?: Date) => {
    day += 1;
    const start = startAt ?? new Date(at(day, 10));
    const booking = await prisma.booking.create({
      data: {
        spaceId,
        renterId,
        startAt: start,
        endAt: new Date(start.getTime() + 2 * HOUR),
        unit: 'HOUR',
        subtotal: 24000,
        fee: 2400,
        total: TOTAL,
        status: 'CONFIRMED',
        stripeCheckoutSessionId: `cs_test_${SUFFIX}_${day}`,
      },
    });
    return booking.id;
  };
  /** Le agrega el pago, como lo dejaría el webhook después de cobrar. */
  const paid = (bookingId: string) =>
    prisma.payment.create({
      data: {
        bookingId,
        stripeSessionId: `cs_test_${SUFFIX}_${bookingId}`,
        stripePaymentIntentId: `pi_test_${SUFFIX}_${bookingId}`,
        amount: TOTAL,
        fee: 2400,
        status: 'SUCCEEDED',
      },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    gateway = app.get(REFUND_GATEWAY);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    const space = await prisma.space.create({
      // Desactivado, para no aparecer en el catálogo que revisan otros e2e; sus reservas siguen vigentes.
      data: { ownerId, name: `Sala ${SUFFIX}`, status: 'INACTIVE', address: 'Alameda 123' },
    });
    spaceId = space.id;
  });

  beforeEach(() => {
    refund = jest.spyOn(gateway, 'refund').mockResolvedValue(undefined);
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    refund.mockRestore();
    logError.mockRestore();
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { booking: { spaceId } } });
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } });
    await app.close();
  });

  it('sin Stripe el puerto es PaymentRefundService con el gateway Noop', () => {
    expect(app.get(PAYMENT_REFUNDER)).toBeInstanceOf(PaymentRefundService);
    expect(gateway).toBeInstanceOf(NoopRefundGateway);
  });

  it.each([
    ['el propietario', () => ownerId],
    ['el arrendatario con más de 24 horas', () => renterId],
  ])('cancela %s: se pide el total, queda en la base y se ve en la reserva y en mis pagos', async (_name, actor) => {
    const id = await confirmed();
    const payment = await paid(id);

    const { body } = await cancel(id, actor()).expect(200);

    expect(body).toMatchObject({ id, status: 'CANCELLED', refundedAmount: TOTAL });
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledWith({
      paymentId: payment.id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: TOTAL,
      alreadyRefunded: 0,
    });
    expect(await statusOf(id)).toBe('CANCELLED');
    expect(await paymentOf(id)).toMatchObject({ status: 'REFUNDED', refundedAmount: TOTAL });

    const detail = await request(server()).get(`/api/bookings/${id}`).set(bearer(app, renterId)).expect(200);
    expect((detail.body as { refundedAmount: number }).refundedAmount).toBe(TOTAL);
    const mine = await request(server()).get('/api/payments/me?pageSize=50').set(bearer(app, renterId)).expect(200);
    expect((mine.body as { items: unknown[] }).items).toContainEqual(
      expect.objectContaining({ id: payment.id, bookingId: id, refundedAmount: TOTAL, status: 'REFUNDED' }),
    );
  });

  it('el propietario con menos de 24 horas también reembolsa el total', async () => {
    const id = await confirmed(new Date(Date.now() + 3 * HOUR));
    await paid(id);

    await cancel(id, ownerId).expect(200);

    expect(await paymentOf(id)).toMatchObject({ status: 'REFUNDED', refundedAmount: TOTAL });
  });

  it('el arrendatario con menos de 24 horas cancela sin reembolso: no se pide y el pago no cambia', async () => {
    const id = await confirmed(new Date(Date.now() + 3 * HOUR));
    await paid(id);

    const { body } = await cancel(id, renterId).expect(200);

    expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: 0 });
    expect(refund).not.toHaveBeenCalled();
    expect(await paymentOf(id)).toMatchObject({ status: 'SUCCEEDED', refundedAmount: 0 });
  });

  it('si el gateway falla, la reserva queda cancelada, responde 200 y el pago no cambia', async () => {
    const id = await confirmed();
    await paid(id);
    refund.mockRejectedValue(new Error('Stripe no responde'));

    const { body } = await cancel(id, ownerId).expect(200);

    expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: 0 });
    expect(await statusOf(id)).toBe('CANCELLED');
    expect(await paymentOf(id)).toMatchObject({ status: 'SUCCEEDED', refundedAmount: 0 });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining(id));
  });

  it('un pago sin PaymentIntent no llama al gateway: se cancela y queda en el log', async () => {
    const id = await confirmed();
    const payment = await paid(id);
    await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: null } });

    const { body } = await cancel(id, ownerId).expect(200);

    expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: 0 });
    expect(refund).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining(id));
  });

  it('una reserva sin pago se cancela normal, sin llamar al gateway', async () => {
    const id = await confirmed();

    const { body } = await cancel(id, ownerId).expect(200);

    expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: 0 });
    expect(refund).not.toHaveBeenCalled();
  });

  it('con el Noop de verdad (sin Stripe) un pago cobrado no queda como reembolsado', async () => {
    refund.mockRestore();
    const id = await confirmed();
    await paid(id);

    const { body } = await cancel(id, ownerId).expect(200);

    expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: 0 });
    expect(await paymentOf(id)).toMatchObject({ status: 'SUCCEEDED', refundedAmount: 0 });
  });

  it.each([
    ['del total', TOTAL, 'REFUNDED'],
    ['parcial', 10000, 'SUCCEEDED'],
  ])('dos reembolsos %s simultáneos, con los dos ya pasados por el gateway: escribe uno solo y no suma dos veces', async (_name, amount, status) => {
    const id = await confirmed();
    await paid(id);
    const refunder = app.get<PaymentRefundService>(PAYMENT_REFUNDER);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // El gateway retiene a cada llamada hasta que llega la otra: las dos leyeron el pago antes de que alguna escriba.
    const waiting: (() => void)[] = [];
    refund.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          waiting.push(resolve);
          if (waiting.length === 2) waiting.forEach((release) => release());
        }),
    );

    try {
      await Promise.all([refunder.refundBooking(id, amount, 'Prueba'), refunder.refundBooking(id, amount, 'Prueba')]);

      expect(refund).toHaveBeenCalledTimes(2);
      expect(refund.mock.calls[0]).toEqual(refund.mock.calls[1]);
      expect(await paymentOf(id)).toMatchObject({ status, refundedAmount: amount });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cambió mientras se reembolsaba'));
    } finally {
      warn.mockRestore();
    }
  });

  it('si la base falla después de que Stripe reembolsó: responde 200 con lo devuelto y el log dice cómo reparar', async () => {
    const id = await confirmed();
    const payment = await paid(id);
    const write = jest.spyOn(prisma.payment, 'updateMany').mockRejectedValueOnce(new Error('la base no responde'));

    try {
      const { body } = await cancel(id, ownerId).expect(200);

      expect(body).toMatchObject({ status: 'CANCELLED', refundedAmount: TOTAL });
      expect(refund).toHaveBeenCalledTimes(1);
      expect(await paymentOf(id)).toMatchObject({ status: 'SUCCEEDED', refundedAmount: 0 });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining(`Stripe reembolsó ${TOTAL} CLP del pago ${payment.id}`));
    } finally {
      write.mockRestore();
    }
  });
});
