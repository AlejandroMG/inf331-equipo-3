import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-fav-${Date.now()}`;
const SECRET = `Oficina secreta ${SUFFIX}`;

interface PageBody {
  items: Array<Record<string, unknown> & { id: string; name: string }>;
  total: number;
  page: number;
  pageSize: number;
}

describe('Favoritos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let otherId: string;
  let ownerId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;
  const ids: Record<string, string> = {};

  const as = (id: string) => bearer(app, id);
  const server = () => app.getHttpServer();
  const list = (query = '', id = userId) => request(server()).get(`/api/favorites${query}`).set(as(id));
  const idsOf = (id = userId) => request(server()).get('/api/favorites/ids').set(as(id));
  const add = (spaceId: string, id = userId) => request(server()).put(`/api/favorites/${spaceId}`).set(as(id));
  const remove = (spaceId: string, id = userId) => request(server()).delete(`/api/favorites/${spaceId}`).set(as(id));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    userId = (await user('user')).id;
    otherId = (await user('other')).id;
    ownerId = (await user('owner')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;

    const base = {
      ownerId,
      typeId,
      regionId,
      communeId,
      description: 'Sala luminosa',
      capacity: 10,
      pricePerHour: 12000,
      address: 'Av. Pública 123',
      addressDetail: SECRET,
    };
    for (const [key, status] of [['A', 'ACTIVE'], ['B', 'ACTIVE'], ['C', 'ACTIVE'], ['Borrador', 'DRAFT'], ['Inactivo', 'INACTIVE']] as const) {
      const space = await prisma.space.create({ data: { ...base, name: `${key} ${SUFFIX}`, status } });
      ids[key] = space.id;
    }
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId, ownerId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  afterEach(async () => {
    await prisma.favorite.deleteMany({ where: { userId: { in: [userId, otherId] } } });
  });

  describe('sin sesión', () => {
    it('un usuario que no existe da 401 en todos los endpoints', async () => {
      const ghost = bearer(app, 'no-existe');
      await request(server()).get('/api/favorites').set(ghost).expect(401);
      await request(server()).get('/api/favorites/ids').set(ghost).expect(401);
      await request(server()).put(`/api/favorites/${ids.A}`).set(ghost).expect(401);
      await request(server()).delete(`/api/favorites/${ids.A}`).set(ghost).expect(401);
    });
  });

  describe('PUT /api/favorites/:spaceId', () => {
    it('guarda el espacio y responde 204 sin cuerpo', async () => {
      const response = await add(ids.A).expect(204);

      expect(response.body).toEqual({});
      expect(await prisma.favorite.count({ where: { userId, spaceId: ids.A } })).toBe(1);
    });

    it('es idempotente: guardarlo otra vez no lo duplica ni falla', async () => {
      await add(ids.A).expect(204);
      await add(ids.A).expect(204);

      expect(await prisma.favorite.count({ where: { userId } })).toBe(1);
    });

    it('guardarlo dos veces a la vez tampoco falla', async () => {
      const responses = await Promise.all([add(ids.B), add(ids.B), add(ids.B)]);

      expect(responses.map((r) => r.status)).toEqual([204, 204, 204]);
      expect(await prisma.favorite.count({ where: { userId } })).toBe(1);
    });

    it.each([
      ['un espacio que no existe', 'no-existe'],
      ['un borrador', 'Borrador'],
      ['un espacio inactivo', 'Inactivo'],
    ])('%s da 404 y no guarda nada', async (_name, key) => {
      await add(ids[key] ?? key).expect(404);

      expect(await prisma.favorite.count({ where: { userId } })).toBe(0);
    });

    it('cada usuario tiene su propia lista', async () => {
      await add(ids.A).expect(204);
      await add(ids.A, otherId).expect(204);
      await add(ids.B, otherId).expect(204);

      expect((await list()).body).toMatchObject({ total: 1 });
      expect((await list('', otherId)).body).toMatchObject({ total: 2 });
    });
  });

  describe('DELETE /api/favorites/:spaceId', () => {
    it('lo quita y responde 204', async () => {
      await add(ids.A).expect(204);

      await remove(ids.A).expect(204);

      expect(await prisma.favorite.count({ where: { userId } })).toBe(0);
    });

    it('es idempotente: quitar uno que no estaba no es un error', async () => {
      await remove(ids.A).expect(204);
      await remove('no-existe').expect(204);
    });

    it('solo quita el del usuario que lo pide', async () => {
      await add(ids.A).expect(204);
      await add(ids.A, otherId).expect(204);

      await remove(ids.A).expect(204);

      expect(await prisma.favorite.count({ where: { spaceId: ids.A, userId: otherId } })).toBe(1);
    });
  });

  describe('GET /api/favorites', () => {
    it('sin favoritos devuelve una página vacía', async () => {
      const { body } = await list().expect(200);

      expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 12 });
    });

    it('lista los favoritos como tarjetas del catálogo, el último guardado primero', async () => {
      await add(ids.A).expect(204);
      await add(ids.C).expect(204);
      await add(ids.B).expect(204);

      const { body } = (await list().expect(200)) as { body: PageBody };

      expect(body.items.map((i) => i.id)).toEqual([ids.B, ids.C, ids.A]);
      expect(body.total).toBe(3);
      expect(body.items[0]).toEqual({
        id: ids.B,
        name: `B ${SUFFIX}`,
        typeName: `Tipo ${SUFFIX}`,
        communeName: `Comuna ${SUFFIX}`,
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: null,
        coverUrl: null,
      });
    });

    it('un espacio que se desactiva deja de verse, y reaparece si se vuelve a activar', async () => {
      await add(ids.A).expect(204);
      await add(ids.B).expect(204);

      await prisma.space.update({ where: { id: ids.A }, data: { status: 'INACTIVE' } });
      const hidden = (await list().expect(200)).body as PageBody;
      expect(hidden.items.map((i) => i.id)).toEqual([ids.B]);
      expect(hidden.total).toBe(1);
      expect((await idsOf().expect(200)).body).toEqual([ids.B]);

      await prisma.space.update({ where: { id: ids.A }, data: { status: 'ACTIVE' } });
      expect(((await list().expect(200)).body as PageBody).total).toBe(2);
    });

    it('pagina', async () => {
      await add(ids.A).expect(204);
      await add(ids.B).expect(204);
      await add(ids.C).expect(204);

      const first = (await list('?pageSize=2').expect(200)).body as PageBody;
      const second = (await list('?pageSize=2&page=2').expect(200)).body as PageBody;

      expect(first.items.map((i) => i.id)).toEqual([ids.C, ids.B]);
      expect(second.items.map((i) => i.id)).toEqual([ids.A]);
      expect([first.total, second.total, second.page]).toEqual([3, 3, 2]);
    });

    it.each(['page=0', 'pageSize=51', 'pageSize=abc', 'q=sala', 'sort=price_asc'])('rechaza el parámetro %s con 400', async (query) => {
      await list(`?${query}`).expect(400);
    });

    it('nunca trae el detalle privado de la dirección ni las coordenadas', async () => {
      await prisma.space.update({ where: { id: ids.A }, data: { latitude: -33.448912, longitude: -70.669273 } });
      await add(ids.A).expect(204);

      const { text } = await list().expect(200);

      for (const forbidden of [SECRET, 'addressDetail', 'ownerId', 'latitude', '448912']) {
        expect(text).not.toContain(forbidden);
      }
    });
  });

  describe('GET /api/favorites/ids', () => {
    it('devuelve solo los ids, el último guardado primero', async () => {
      await add(ids.A).expect(204);
      await add(ids.B).expect(204);

      const { body } = await idsOf().expect(200);

      expect(body).toEqual([ids.B, ids.A]);
    });
  });

  describe('al borrar', () => {
    it('borrar el espacio borra sus favoritos', async () => {
      const space = await prisma.space.create({ data: { ownerId, name: `Efímero ${SUFFIX}`, status: 'ACTIVE' } });
      await add(space.id).expect(204);

      await prisma.space.delete({ where: { id: space.id } });

      expect(await prisma.favorite.count({ where: { spaceId: space.id } })).toBe(0);
    });

    it('borrar el usuario borra sus favoritos', async () => {
      const extra = await prisma.user.create({ data: { email: `extra-${SUFFIX}@rentsmart.test`, passwordHash: 'x', name: 'extra' } });
      await add(ids.A, extra.id).expect(204);

      await prisma.user.delete({ where: { id: extra.id } });

      expect(await prisma.favorite.count({ where: { userId: extra.id } })).toBe(0);
    });
  });
});
