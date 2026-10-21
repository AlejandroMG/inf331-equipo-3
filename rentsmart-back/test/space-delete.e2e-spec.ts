import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-delete-${Date.now()}`;

describe('Eliminar un espacio (ES-08, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;

  const del = (id: string, userId = ownerId) =>
    request(app.getHttpServer()).delete(`/api/spaces/${id}`).set(bearer(app, userId));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    otherId = (await user('other')).id;
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
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  /** Un espacio publicado con foto, horario y equipamiento de ejemplo. */
  async function publishedSpace(status: 'ACTIVE' | 'BLOCKED' | 'DRAFT' = 'ACTIVE') {
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
        address: 'Av. Pública 123',
        status,
        ...(status === 'BLOCKED' && { blockedReason: 'Fotos que no corresponden' }),
        photos: { create: { storagePath: `spaces/x/${SUFFIX}-${Math.random()}.jpg`, url: 'https://fotos.test/a.jpg', position: 0 } },
        rulesWeek: { create: { weekday: 1, startTime: '09:00', endTime: '21:00' } },
      },
    });
    return space.id;
  }

  async function addBooking(spaceId: string, status: 'CONFIRMED' | 'CANCELLED') {
    const day = new Date('2099-03-02T00:00:00.000Z').getTime();
    await prisma.booking.create({
      data: {
        spaceId,
        renterId: otherId,
        startAt: new Date(day + 13 * 3_600_000),
        endAt: new Date(day + 15 * 3_600_000),
        unit: 'HOUR',
        subtotal: 24000,
        total: 24000,
        status,
      },
    });
  }

  it('elimina un espacio propio sin reservas, con sus fotos, horario y favoritos', async () => {
    const id = await publishedSpace();
    await prisma.favorite.create({ data: { userId: otherId, spaceId: id } });

    await del(id).expect(204);

    expect(await prisma.space.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.spacePhoto.count({ where: { spaceId: id } })).toBe(0);
    expect(await prisma.availabilityRule.count({ where: { spaceId: id } })).toBe(0);
    expect(await prisma.favorite.count({ where: { spaceId: id } })).toBe(0);
    await request(app.getHttpServer()).get(`/api/catalog/${id}`).expect(404);
  });

  it('elimina un borrador', async () => {
    const id = await publishedSpace('DRAFT');

    await del(id).expect(204);

    expect(await prisma.space.findUnique({ where: { id } })).toBeNull();
  });

  it('no elimina un espacio con reservas, aunque estén canceladas, y sugiere desactivarlo', async () => {
    const id = await publishedSpace();
    await addBooking(id, 'CANCELLED');

    const res = await del(id).expect(409);

    expect((res.body as { message: string }).message).toMatch(/desactívalo/);
    expect(await prisma.space.findUnique({ where: { id } })).not.toBeNull();
  });

  it('no deja eliminar el espacio de otro usuario', async () => {
    const id = await publishedSpace();

    await del(id, otherId).expect(403);

    expect(await prisma.space.findUnique({ where: { id } })).not.toBeNull();
  });

  it('no deja eliminar un espacio bloqueado por un administrador', async () => {
    const id = await publishedSpace('BLOCKED');

    await del(id).expect(403);

    expect(await prisma.space.findUnique({ where: { id } })).not.toBeNull();
  });

  it('responde 404 si el espacio no existe', async () => {
    await del('00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('pide sesión', async () => {
    const id = await publishedSpace();

    await request(app.getHttpServer()).delete(`/api/spaces/${id}`).expect(401);
  });
});
