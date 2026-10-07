import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-edit-${Date.now()}`;

describe('Editar un espacio con reservas (ES-05, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let renterId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;

  const as = (userId: string) => ({ 'x-user-id': userId });
  const patch = (id: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).patch(`/api/spaces/${id}`).set(as(ownerId)).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    renterId = (await user('renter')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;
  });

  afterAll(async () => {
    const spaces = await prisma.space.findMany({ where: { ownerId }, select: { id: true } });
    const spaceIds = spaces.map((s) => s.id);
    await prisma.booking.deleteMany({ where: { spaceId: { in: spaceIds } } });
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, renterId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  /** Un espacio publicado y completo, con una reserva confirmada de 3 horas a $12.000 la hora. */
  async function publishedWithBooking() {
    const space = await prisma.space.create({
      data: {
        ownerId,
        typeId,
        regionId,
        communeId,
        name: `Sala ${SUFFIX}`,
        description: 'Sala luminosa',
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: 90000,
        address: 'Av. Pública 123',
        status: 'ACTIVE',
        photos: { create: { storagePath: `spaces/x/${SUFFIX}.jpg`, url: 'https://fotos.test/a.jpg', position: 0 } },
        rulesWeek: { create: { weekday: 1, startTime: '09:00', endTime: '21:00' } },
      },
    });
    const day = new Date('2099-03-02T00:00:00.000Z').getTime();
    const booking = await prisma.booking.create({
      data: {
        spaceId: space.id,
        renterId,
        startAt: new Date(day + 13 * 3_600_000),
        endAt: new Date(day + 16 * 3_600_000),
        unit: 'HOUR',
        subtotal: 36000,
        fee: 3600,
        total: 39600,
        status: 'CONFIRMED',
      },
    });
    return { spaceId: space.id, bookingId: booking.id };
  }

  const totalsOf = async (bookingId: string) => {
    const { subtotal, fee, total, status } = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    return { subtotal, fee, total, status };
  };

  it('un cambio de precio no toca el total de las reservas que ya existen', async () => {
    const { spaceId, bookingId } = await publishedWithBooking();

    await patch(spaceId, { pricePerHour: 20000, pricePerDay: 150000 }).expect(200);

    expect(await totalsOf(bookingId)).toEqual({ subtotal: 36000, fee: 3600, total: 39600, status: 'CONFIRMED' });
  });

  it('el precio nuevo es el que ve el público, para las reservas que vengan', async () => {
    const { spaceId } = await publishedWithBooking();

    await patch(spaceId, { pricePerHour: 20000 }).expect(200);

    const { body } = await request(app.getHttpServer()).get(`/api/catalog/${spaceId}`).expect(200);
    expect(body).toMatchObject({ pricePerHour: 20000, pricePerDay: 90000 });
  });

  it('quitar un precio (dejar de arrendar por día) tampoco cambia las reservas existentes', async () => {
    const { spaceId, bookingId } = await publishedWithBooking();

    await patch(spaceId, { pricePerDay: null }).expect(200);

    expect(await totalsOf(bookingId)).toMatchObject({ total: 39600, status: 'CONFIRMED' });
  });

  it('editar otros datos del espacio publicado deja intacta la reserva', async () => {
    const { spaceId, bookingId } = await publishedWithBooking();

    await patch(spaceId, { name: `Renombrada ${SUFFIX}`, description: 'Otra descripción', capacity: 12 }).expect(200);

    expect(await totalsOf(bookingId)).toEqual({ subtotal: 36000, fee: 3600, total: 39600, status: 'CONFIRMED' });
  });

  it('desactivar el espacio mantiene las reservas confirmadas (ES-06)', async () => {
    const { spaceId, bookingId } = await publishedWithBooking();

    await request(app.getHttpServer()).patch(`/api/spaces/${spaceId}/status`).set(as(ownerId)).send({ status: 'INACTIVE' }).expect(200);

    expect(await totalsOf(bookingId)).toMatchObject({ status: 'CONFIRMED', total: 39600 });
  });
});
