import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-loc-${Date.now()}`;

// Punto exacto que marca el propietario, y lo que ve el público (3 decimales y un radio).
const EXACT = { latitude: -33.448912, longitude: -70.669273 };
const SHOWN = { latitude: -33.449, longitude: -70.669, radiusMeters: 150 };

interface SpaceBody {
  id: string;
  latitude: number | null;
  longitude: number | null;
  [key: string]: unknown;
}

describe('Ubicación en el mapa (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;

  const as = (userId: string) => bearer(app, userId);

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
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  const create = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/spaces').set(as(ownerId)).send({ name: `Sala ${SUFFIX}`, ...body });
  const patch = (id: string, body: Record<string, unknown>, userId = ownerId) =>
    request(app.getHttpServer()).patch(`/api/spaces/${id}`).set(as(userId)).send(body);
  const owned = (id: string) => request(app.getHttpServer()).get(`/api/spaces/${id}`).set(as(ownerId));
  const publicDetail = (id: string) => request(app.getHttpServer()).get(`/api/catalog/${id}`);

  /** Un espacio activo, con comuna y dirección, listo para verse en el catálogo. */
  async function activeSpace(location: Record<string, unknown> = {}) {
    const { body } = await create({ typeId, regionId, communeId, address: 'Av. Pública 123', ...location }).expect(201);
    await prisma.space.update({ where: { id: (body as SpaceBody).id }, data: { status: 'ACTIVE' } });
    return (body as SpaceBody).id;
  }

  describe('el propietario marca el punto', () => {
    it('crea el espacio con el punto y se lo devuelve exacto', async () => {
      const { body } = await create(EXACT).expect(201);

      expect(body).toMatchObject(EXACT);
      const read = await owned((body as SpaceBody).id).expect(200);
      expect(read.body).toMatchObject(EXACT);
    });

    it('un espacio sin punto lo devuelve en null', async () => {
      const { body } = await create({}).expect(201);

      expect(body).toMatchObject({ latitude: null, longitude: null });
    });

    it('marca, mueve y borra el punto en una edición', async () => {
      const { id } = (await create({}).expect(201)).body as SpaceBody;

      expect((await patch(id, EXACT).expect(200)).body).toMatchObject(EXACT);
      expect((await patch(id, { latitude: -33.5 }).expect(200)).body).toMatchObject({
        latitude: -33.5,
        longitude: EXACT.longitude,
      });
      expect((await patch(id, { latitude: null, longitude: null }).expect(200)).body).toMatchObject({
        latitude: null,
        longitude: null,
      });
    });

    it('una edición que no habla del punto no lo toca', async () => {
      const { id } = (await create(EXACT).expect(201)).body as SpaceBody;

      const { body } = await patch(id, { description: 'Luminosa' }).expect(200);

      expect(body).toMatchObject(EXACT);
    });

    it('rechaza la latitud sin la longitud, y al revés', async () => {
      await create({ latitude: -33.4 }).expect(400);
      await create({ longitude: -70.6 }).expect(400);
      const { id } = (await create({}).expect(201)).body as SpaceBody;
      await patch(id, { latitude: -33.4 }).expect(400);
      const marked = (await create(EXACT).expect(201)).body as SpaceBody;
      await patch(marked.id, { longitude: null }).expect(400);
    });

    it.each([
      ['una latitud fuera de Chile', { latitude: 40.4, longitude: -70.6 }],
      ['una longitud fuera de Chile', { latitude: -33.4, longitude: 2.3 }],
      ['coordenadas en el hemisferio equivocado', { latitude: 33.4, longitude: 70.6 }],
      ['una latitud que no es un número', { latitude: 'norte', longitude: -70.6 }],
      ['más de 6 decimales', { latitude: -33.44891234, longitude: -70.6 }],
    ])('rechaza %s', async (_name, body) => {
      await create(body).expect(400);
    });

    it('no deja editar el punto de un espacio ajeno', async () => {
      const { id } = (await create({}).expect(201)).body as SpaceBody;

      await patch(id, EXACT, otherId).expect(403);

      expect(((await owned(id).expect(200)).body as SpaceBody).latitude).toBeNull();
    });

    it('la base de datos tampoco admite solo una de las dos', async () => {
      const { id } = (await create({}).expect(201)).body as SpaceBody;

      await expect(prisma.space.update({ where: { id }, data: { latitude: -33.4 } })).rejects.toThrow();
    });
  });

  describe('lo que ve el público', () => {
    it('el detalle trae la ubicación aproximada con su radio', async () => {
      const id = await activeSpace(EXACT);

      const { body } = await publicDetail(id).expect(200);

      expect((body as { location: unknown }).location).toEqual(SHOWN);
    });

    it('el punto exacto no sale en ninguna parte del detalle público', async () => {
      const id = await activeSpace(EXACT);

      const { body } = await publicDetail(id).expect(200);

      const json = JSON.stringify(body);
      expect(body).not.toHaveProperty('latitude');
      expect(body).not.toHaveProperty('longitude');
      expect(json).not.toContain('448912');
      expect(json).not.toContain('669273');
    });

    it('sin punto marcado la ubicación es null', async () => {
      const id = await activeSpace();

      const { body } = await publicDetail(id).expect(200);

      expect((body as { location: unknown }).location).toBeNull();
    });

    it('si el propietario borra el punto, el detalle público lo deja de mostrar', async () => {
      const id = await activeSpace(EXACT);
      // Un espacio publicado debe seguir completo para editarse: se desactiva, se edita y se vuelve a activar.
      await prisma.space.update({ where: { id }, data: { status: 'INACTIVE' } });
      await patch(id, { latitude: null, longitude: null }).expect(200);
      await prisma.space.update({ where: { id }, data: { status: 'ACTIVE' } });

      const { body } = await publicDetail(id).expect(200);

      expect((body as { location: unknown }).location).toBeNull();
    });

    it('el listado del catálogo no trae ninguna coordenada', async () => {
      const id = await activeSpace(EXACT);

      const { body } = await request(app.getHttpServer()).get('/api/catalog?pageSize=50').expect(200);

      const items = (body as { items: Array<Record<string, unknown> & { id: string }> }).items;
      const item = items.find((i) => i.id === id);
      expect(item).toBeDefined();
      for (const key of ['latitude', 'longitude', 'location']) expect(item).not.toHaveProperty(key);
    });
  });
});
