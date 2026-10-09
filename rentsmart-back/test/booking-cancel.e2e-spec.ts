import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { BookingStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-cancel-${Date.now()}`;
const HOUR = 3_600_000;
const REASON = 'Se suspendió la reunión';

describe('Cancelar una reserva (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let otherId: string;
  let spaceId: string;

  const server = () => app.getHttpServer();
  const cancel = (bookingId: string, userId: string, body: unknown = { reason: REASON }) =>
    request(server())
      .post(`/api/bookings/${bookingId}/cancel`)
      .set(bearer(app, userId))
      .send(body as object);
  const statusOf = async (bookingId: string) =>
    (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;
  const events = (bookingId: string) =>
    prisma.bookingEvent.findMany({
      where: { bookingId },
      select: { fromStatus: true, toStatus: true, actorId: true, reason: true },
      orderBy: { createdAt: 'asc' },
    });

  let slot = 0;
  /** Una reserva del arrendatario que parte en `startsInHours`, cada una en un día distinto. */
  const booking = async (status: BookingStatus, extra: { startsInHours?: number; expiresAt?: Date } = {}) => {
    slot += 1;
    const startAt = new Date(Date.now() + (extra.startsInHours ?? 72 + slot * 24) * HOUR);
    startAt.setUTCMinutes(0, 0, 0);
    const created = await prisma.booking.create({
      data: {
        spaceId,
        renterId,
        startAt,
        endAt: new Date(startAt.getTime() + 2 * HOUR),
        unit: 'HOUR',
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        status,
        expiresAt: extra.expiresAt ?? null,
      },
    });
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
    const space = await prisma.space.create({
      data: {
        ownerId,
        name: `Sala ${SUFFIX}`,
        // Desactivado, para no aparecer en el catálogo que revisan otros e2e; sus reservas siguen vigentes.
        status: 'INACTIVE',
        address: 'Alameda 123',
        addressDetail: 'Oficina 402',
        photos: { create: [{ url: 'https://fotos.test/portada.jpg', storagePath: `${SUFFIX}/portada.jpg`, position: 0 }] },
      },
    });
    spaceId = space.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId, otherId] } } });
    await app.close();
  });

  describe('200', () => {
    it('el arrendatario cancela su reserva confirmada: responde la reserva cancelada, sin el detalle privado', async () => {
      const id = await booking('CONFIRMED');

      const { body } = await cancel(id, renterId).expect(200);

      expect(body).toEqual({
        id,
        status: 'CANCELLED',
        unit: 'HOUR',
        startAt: expect.any(String),
        endAt: expect.any(String),
        subtotal: 24000,
        fee: 2400,
        total: 26400,
        expiresAt: null,
        createdAt: expect.any(String),
        space: {
          id: spaceId,
          name: `Sala ${SUFFIX}`,
          communeName: null,
          address: 'Alameda 123',
          addressDetail: null,
          coverUrl: 'https://fotos.test/portada.jpg',
        },
      });
      expect(await statusOf(id)).toBe('CANCELLED');
      expect(await events(id)).toEqual([
        { fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorId: renterId, reason: REASON },
      ]);
    });

    it('el dueño del espacio cancela una reserva confirmada de su espacio', async () => {
      const id = await booking('CONFIRMED');

      const { body } = await cancel(id, ownerId, { reason: 'El espacio estará en mantención' }).expect(200);

      expect(body).toMatchObject({ id, status: 'CANCELLED' });
      expect(await events(id)).toEqual([
        { fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorId: ownerId, reason: 'El espacio estará en mantención' },
      ]);
    });

    it('se puede cancelar con menos de 24 horas: la política solo decide el reembolso', async () => {
      const renterLate = await booking('CONFIRMED', { startsInHours: 3 });
      const ownerLate = await booking('CONFIRMED', { startsInHours: 5 });

      await cancel(renterLate, renterId).expect(200);
      await cancel(ownerLate, ownerId).expect(200);

      expect(await statusOf(renterLate)).toBe('CANCELLED');
      expect(await statusOf(ownerLate)).toBe('CANCELLED');
    });

    it('una reserva pendiente que no ha vencido se cancela, por el arrendatario o por el dueño', async () => {
      const expiresAt = new Date(Date.now() + 20 * 60_000);
      const byRenter = await booking('PENDING', { expiresAt });
      const byOwner = await booking('PENDING', { expiresAt });

      await cancel(byRenter, renterId).expect(200);
      await cancel(byOwner, ownerId).expect(200);

      expect(await events(byRenter)).toEqual([
        { fromStatus: 'PENDING', toStatus: 'CANCELLED', actorId: renterId, reason: REASON },
      ]);
      expect(await statusOf(byOwner)).toBe('CANCELLED');
    });

    it('guarda el motivo sin los espacios de los extremos', async () => {
      const id = await booking('CONFIRMED');

      await cancel(id, renterId, { reason: `   ${REASON}  ` }).expect(200);

      expect((await events(id))[0].reason).toBe(REASON);
    });
  });

  describe('400', () => {
    it.each([
      ['sin motivo', {}],
      ['un motivo que no es texto', { reason: 12345 }],
      ['un motivo de menos de 5 caracteres', { reason: 'nada' }],
      ['un motivo de solo espacios', { reason: '          ' }],
      ['un motivo de más de 500 caracteres', { reason: 'a'.repeat(501) }],
      ['un campo desconocido', { reason: REASON, refund: 1000 }],
    ])('con %s no cancela', async (_name, body) => {
      const id = await booking('CONFIRMED');

      const response = await cancel(id, renterId, body).expect(400);

      expect((response.body as { message: unknown }).message).toBeDefined();
      expect(await statusOf(id)).toBe('CONFIRMED');
      expect(await events(id)).toEqual([]);
    });

    it('sin cuerpo no cancela', async () => {
      const id = await booking('CONFIRMED');

      await request(server()).post(`/api/bookings/${id}/cancel`).set(bearer(app, renterId)).expect(400);

      expect(await statusOf(id)).toBe('CONFIRMED');
    });

    it('acepta un motivo de 5 y de 500 caracteres', async () => {
      const short = await booking('CONFIRMED');
      const long = await booking('CONFIRMED');

      await cancel(short, renterId, { reason: 'Viaje' }).expect(200);
      await cancel(long, renterId, { reason: 'a'.repeat(500) }).expect(200);
    });
  });

  it('401 sin sesión', async () => {
    const id = await booking('CONFIRMED');

    await request(server()).post(`/api/bookings/${id}/cancel`).send({ reason: REASON }).expect(401);

    expect(await statusOf(id)).toBe('CONFIRMED');
  });

  it('403 a quien no es el arrendatario ni el dueño del espacio', async () => {
    const id = await booking('CONFIRMED');

    await cancel(id, otherId).expect(403);

    expect(await statusOf(id)).toBe('CONFIRMED');
    expect(await events(id)).toEqual([]);
  });

  it('404 si la reserva no existe', async () => {
    await cancel('no-existe', renterId).expect(404);
  });

  describe('409', () => {
    it.each(['PAID', 'FINISHED', 'CANCELLED', 'EXPIRED'] as const)('una reserva %s no se puede cancelar', async (status) => {
      const id = await booking(status);

      const { body } = await cancel(id, renterId).expect(409);
      await cancel(id, ownerId).expect(409);

      expect(body).toMatchObject({ statusCode: 409, error: 'Conflict' });
      expect(await statusOf(id)).toBe(status);
      expect(await events(id)).toEqual([]);
    });

    it('cancelar dos veces: la segunda responde 409 y no deja otro evento', async () => {
      const id = await booking('CONFIRMED');
      await cancel(id, renterId).expect(200);

      await cancel(id, ownerId).expect(409);

      expect(await events(id)).toHaveLength(1);
    });

    it('una pendiente cuyo plazo de pago venció queda EXPIRED por el sistema, no cancelada', async () => {
      const id = await booking('PENDING', { expiresAt: new Date(Date.now() - 60_000) });

      await cancel(id, renterId).expect(409);

      expect(await statusOf(id)).toBe('EXPIRED');
      expect(await events(id)).toEqual([
        { fromStatus: 'PENDING', toStatus: 'EXPIRED', actorId: null, reason: 'Venció el plazo de pago' },
      ]);
    });

    it('dos cancelaciones a la vez: una gana y la otra responde 409', async () => {
      const id = await booking('CONFIRMED');

      const responses = await Promise.all([cancel(id, renterId), cancel(id, ownerId)]);

      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(await events(id)).toHaveLength(1);
    });
  });
});
