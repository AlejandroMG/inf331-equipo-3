import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-spc-${Date.now()}`;

interface SpaceBody {
  id: string;
  status: string;
  name: string;
  [key: string]: unknown;
}

describe('Espacios del propietario (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  let typeId: number;
  let regionId: number;
  let otherRegionId: number;
  let communeId: number;
  let otherRegionCommuneId: number;
  let amenityIds: number[];

  const as = (userId: string) => ({ 'x-user-id': userId });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const user = (key: string) =>
      prisma.user.create({
        data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key },
      });
    ownerId = (await user('owner')).id;
    otherId = (await user('other')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;
    const other = await prisma.region.create({
      data: { name: `Otra región ${SUFFIX}`, communes: { create: { name: `Otra comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    otherRegionId = other.id;
    otherRegionCommuneId = other.communes[0].id;
    amenityIds = (
      await Promise.all(['Wifi', 'Proyector'].map((name) => prisma.amenity.create({ data: { name: `${name} ${SUFFIX}` } })))
    ).map((a) => a.id);
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.amenity.deleteMany({ where: { name: { endsWith: SUFFIX } } });
    await prisma.commune.deleteMany({ where: { regionId: { in: [regionId, otherRegionId] } } });
    await prisma.region.deleteMany({ where: { id: { in: [regionId, otherRegionId] } } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  const create = (body: Record<string, unknown>, userId = ownerId) =>
    request(app.getHttpServer()).post('/api/spaces').set(as(userId)).send(body);

  describe('autenticación', () => {
    it('responde 401 si el usuario del encabezado no existe', () => {
      return request(app.getHttpServer())
        .post('/api/spaces')
        .set(as('no-existe'))
        .send({ name: 'Sala' })
        .expect(401);
    });

    it('responde 401 si el usuario está suspendido', async () => {
      const suspended = await prisma.user.create({
        data: { email: `susp-${SUFFIX}@rentsmart.test`, passwordHash: 'x', name: 'Suspendido', status: 'SUSPENDED' },
      });
      try {
        await create({ name: 'Sala' }, suspended.id).expect(401);
      } finally {
        await prisma.user.delete({ where: { id: suspended.id } });
      }
    });
  });

  describe('POST /api/spaces', () => {
    it('crea un borrador con solo el nombre', async () => {
      const { body } = await create({ name: `Sala ${SUFFIX}` }).expect(201);

      expect(body).toEqual({
        id: expect.any(String),
        status: 'DRAFT',
        name: `Sala ${SUFFIX}`,
        typeId: null,
        description: null,
        capacity: null,
        pricePerHour: null,
        pricePerDay: null,
        regionId: null,
        communeId: null,
        address: null,
        addressDetail: null,
        latitude: null,
        longitude: null,
        rules: null,
        amenityIds: [],
        photos: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const saved = await prisma.space.findUnique({ where: { id: (body as SpaceBody).id } });
      expect(saved?.ownerId).toBe(ownerId);
    });

    it('guarda todos los datos y toma la región de la comuna', async () => {
      const { body } = await create({
        name: `Completo ${SUFFIX}`,
        typeId,
        description: 'Sala luminosa',
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: 90000,
        communeId,
        address: 'Av. Pública 123',
        addressDetail: 'Oficina 301',
        rules: 'No fumar',
        amenityIds,
      }).expect(201);

      expect(body).toMatchObject({
        status: 'DRAFT',
        typeId,
        description: 'Sala luminosa',
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: 90000,
        regionId,
        communeId,
        address: 'Av. Pública 123',
        addressDetail: 'Oficina 301',
        rules: 'No fumar',
        amenityIds: [...amenityIds].sort((a, b) => a - b),
      });
    });

    it('no deja crear el espacio ya activo ni de otro dueño', async () => {
      await create({ name: 'Sala', status: 'ACTIVE' }).expect(400);
      await create({ name: 'Sala', ownerId: otherId }).expect(400);
    });

    it.each([
      ['sin nombre', {}],
      ['nombre vacío', { name: '' }],
      ['nombre de más de 100 caracteres', { name: 'a'.repeat(101) }],
      ['capacidad 0', { name: 'S', capacity: 0 }],
      ['capacidad decimal', { name: 'S', capacity: 2.5 }],
      ['capacidad sobre 1000', { name: 'S', capacity: 1001 }],
      ['precio negativo', { name: 'S', pricePerHour: -1 }],
      ['precio 0', { name: 'S', pricePerDay: 0 }],
      ['precio sobre el máximo', { name: 'S', pricePerHour: 10_000_001 }],
      ['equipamiento repetido', { name: 'S', amenityIds: [1, 1] }],
      ['equipamiento que no es lista', { name: 'S', amenityIds: 'wifi' }],
    ])('responde 400 con %s', (_caso, body) => create(body).expect(400));

    it('responde 400 si el tipo, la región, la comuna o el equipamiento no existen', async () => {
      await create({ name: 'S', typeId: 2147483647 }).expect(400);
      await create({ name: 'S', regionId: 2147483647 }).expect(400);
      await create({ name: 'S', communeId: 2147483647 }).expect(400);
      await create({ name: 'S', amenityIds: [2147483647] }).expect(400);
    });

    it('responde 400 si la comuna no pertenece a la región', async () => {
      const { body } = await create({ name: 'S', regionId, communeId: otherRegionCommuneId }).expect(400);

      expect((body as { message: string }).message).toBe('La comuna no pertenece a la región');
    });
  });

  describe('PATCH /api/spaces/:id', () => {
    let spaceId: string;

    beforeEach(async () => {
      const { body } = await create({ name: `Borrador ${SUFFIX}`, pricePerDay: 50000, amenityIds: [amenityIds[0]] }).expect(201);
      spaceId = (body as SpaceBody).id;
    });

    const patch = (body: Record<string, unknown>, userId = ownerId, id = spaceId) =>
      request(app.getHttpServer()).patch(`/api/spaces/${id}`).set(as(userId)).send(body);

    it('guarda solo lo que se manda, paso a paso', async () => {
      await patch({ description: 'Paso 1' }).expect(200);
      const { body } = await patch({ capacity: 8, communeId }).expect(200);

      expect(body).toMatchObject({
        name: `Borrador ${SUFFIX}`,
        description: 'Paso 1',
        capacity: 8,
        communeId,
        regionId,
        pricePerDay: 50000,
        status: 'DRAFT',
      });
    });

    it('null borra un campo opcional', async () => {
      const { body } = await patch({ pricePerDay: null }).expect(200);

      expect(body).toMatchObject({ pricePerDay: null });
    });

    it('reemplaza el equipamiento completo y lo deja como está si no se manda', async () => {
      const replaced = await patch({ amenityIds: [amenityIds[1]] }).expect(200);
      expect((replaced.body as SpaceBody).amenityIds).toEqual([amenityIds[1]]);

      const untouched = await patch({ description: 'Otra cosa' }).expect(200);
      expect((untouched.body as SpaceBody).amenityIds).toEqual([amenityIds[1]]);

      const cleared = await patch({ amenityIds: [] }).expect(200);
      expect((cleared.body as SpaceBody).amenityIds).toEqual([]);
    });

    it('no permite cambiar el estado ni el dueño', async () => {
      await patch({ status: 'ACTIVE' }).expect(400);
      await patch({ ownerId: otherId }).expect(400);
    });

    it('el nombre no se puede borrar', async () => {
      await patch({ name: null }).expect(400);
      await patch({ name: '' }).expect(400);
    });

    it('valida las referencias igual que al crear', async () => {
      await patch({ typeId: 2147483647 }).expect(400);
      await patch({ regionId: otherRegionId, communeId }).expect(400);
    });

    it('responde 403 si el espacio es de otro usuario y no lo modifica', async () => {
      await patch({ name: 'Robado' }, otherId).expect(403);

      const saved = await prisma.space.findUnique({ where: { id: spaceId } });
      expect(saved?.name).toBe(`Borrador ${SUFFIX}`);
    });

    it('responde 404 si el espacio no existe', () => {
      return patch({ name: 'X' }, ownerId, 'no-existe').expect(404);
    });
  });

  describe('GET /api/spaces/:id', () => {
    let spaceId: string;

    beforeAll(async () => {
      const { body } = await create({ name: `Propio ${SUFFIX}`, addressDetail: 'Oficina 301' }).expect(201);
      spaceId = (body as SpaceBody).id;
    });

    it('el dueño ve su espacio con el detalle privado y el estado', async () => {
      const { body } = await request(app.getHttpServer()).get(`/api/spaces/${spaceId}`).set(as(ownerId)).expect(200);

      expect(body).toMatchObject({ id: spaceId, status: 'DRAFT', addressDetail: 'Oficina 301' });
    });

    it('responde 403 a otro usuario y no le muestra nada', async () => {
      const { text } = await request(app.getHttpServer()).get(`/api/spaces/${spaceId}`).set(as(otherId)).expect(403);

      expect(text).not.toContain('Oficina 301');
    });

    it('responde 404 si no existe', () => {
      return request(app.getHttpServer()).get('/api/spaces/no-existe').set(as(ownerId)).expect(404);
    });

    it('responde 401 con un usuario inválido', () => {
      return request(app.getHttpServer()).get(`/api/spaces/${spaceId}`).set(as('no-existe')).expect(401);
    });
  });
});
