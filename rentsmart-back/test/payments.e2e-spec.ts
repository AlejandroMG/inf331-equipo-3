import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { bookingWeek } from './utils/booking-dates';
import { createTestApp } from './utils/create-test-app';

// PA-01: GET /api/payments/me contra la base de test. Las reservas y sus pagos se crean directo en la base, como los
// dejaría una reserva hecha con Stripe Checkout (el e2e del flujo completo está en booking-create.e2e-spec.ts).
const SUFFIX = `e2e-pa01-${Date.now()}`;
const at = bookingWeek(6);

interface PaymentBody {
  id: string;
  bookingId: string;
  spaceName: string;
  amount: number;
  fee: number;
  refundedAmount: number;
  status: string;
  createdAt: string;
}

describe('Mis pagos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let otherId: string;
  let spaceId: string;
  /** Ids de los pagos del arrendatario, del más antiguo al más reciente. */
  const mine: string[] = [];
  let othersPaymentId: string;

  const server = () => app.getHttpServer();
  const myPayments = (query = '', userId = renterId) =>
    request(server()).get(`/api/payments/me${query}`).set(bearer(app, userId));

  /** Una reserva del `renter` en el día `day` a las 10:00 de Chile, con su pago creado `minutesAgo` minutos atrás. */
  const paidBooking = async (renter: string, day: number, minutesAgo: number, status: 'PENDING' | 'SUCCEEDED') => {
    const booking = await prisma.booking.create({
      data: {
        spaceId,
        renterId: renter,
        startAt: new Date(at(day, 10)),
        endAt: new Date(at(day, 12)),
        unit: 'HOUR',
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        status: status === 'SUCCEEDED' ? 'CONFIRMED' : 'PENDING',
        expiresAt: new Date(Date.now() + 31 * 60_000),
        stripeCheckoutSessionId: `cs_test_${SUFFIX}_${renter}_${day}`,
      },
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripeSessionId: `cs_test_${SUFFIX}_${renter}_${day}`,
        amount: 26400,
        fee: 2400,
        status,
        createdAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });
    return payment.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    otherId = (await user('other')).id;
    spaceId = (
      await prisma.space.create({
        data: { ownerId, name: `Sala ${SUFFIX}`, status: 'ACTIVE', address: 'Alameda 123', pricePerHour: 12000 },
      })
    ).id;
    // Tres pagos míos (lunes, martes, miércoles), el del miércoles es el más reciente; y uno de otra persona.
    mine.push(await paidBooking(renterId, 0, 30, 'SUCCEEDED'));
    mine.push(await paidBooking(renterId, 1, 20, 'PENDING'));
    mine.push(await paidBooking(renterId, 2, 10, 'PENDING'));
    othersPaymentId = await paidBooking(otherId, 3, 5, 'PENDING');
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { booking: { spaceId } } });
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId, otherId] } } });
    await app.close();
  });

  it('lista mis pagos, los más recientes primero, con el nombre del espacio y sin los ids de Stripe', async () => {
    const { body } = await myPayments().expect(200);

    const page = body as { items: PaymentBody[]; total: number; page: number; pageSize: number };
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(page.items.map((p) => p.id)).toEqual([...mine].reverse());
    expect(page.items[0]).toEqual({
      id: mine[2],
      bookingId: expect.any(String),
      spaceName: `Sala ${SUFFIX}`,
      amount: 26400,
      fee: 2400,
      refundedAmount: 0,
      status: 'PENDING',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(page.items[2].status).toBe('SUCCEEDED');
  });

  it('pagina con page y pageSize sin cruzar las páginas', async () => {
    const first = (await myPayments('?page=1&pageSize=2').expect(200)).body as { items: PaymentBody[]; total: number };
    const second = (await myPayments('?page=2&pageSize=2').expect(200)).body as { items: PaymentBody[]; total: number };

    expect(first.total).toBe(3);
    expect(first.items.map((p) => p.id)).toEqual([mine[2], mine[1]]);
    expect(second.items.map((p) => p.id)).toEqual([mine[0]]);
  });

  it('no muestra los pagos de otros', async () => {
    const { body } = await myPayments().expect(200);
    expect((body as { items: PaymentBody[] }).items.map((p) => p.id)).not.toContain(othersPaymentId);

    const { body: others } = await myPayments('', otherId).expect(200);
    expect((others as { items: PaymentBody[] }).items.map((p) => p.id)).toEqual([othersPaymentId]);
  });

  it('el dueño del espacio no ve como suyos los pagos de quienes reservaron', async () => {
    const { body } = await myPayments('', ownerId).expect(200);

    expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('responde 401 sin sesión', async () => {
    await request(server()).get('/api/payments/me').expect(401);
  });

  it('responde 400 con una paginación inválida', async () => {
    await myPayments('?pageSize=51').expect(400);
  });
});
