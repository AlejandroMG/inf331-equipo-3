import { INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { uploadsDir } from '../src/storage/storage.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-pub-${Date.now()}`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface SpaceBody {
  id: string;
  status: string;
  [key: string]: unknown;
}

describe('Publicar y activar espacios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;
  const spaceIds: string[] = [];

  const as = (userId: string) => bearer(app, userId);
  const server = () => app.getHttpServer();

  const publish = (id: string, userId = ownerId) => request(server()).post(`/api/spaces/${id}/publish`).set(as(userId));
  const setStatus = (id: string, status: unknown, userId = ownerId) =>
    request(server()).patch(`/api/spaces/${id}/status`).set(as(userId)).send({ status });
  const patch = (id: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/spaces/${id}`).set(as(ownerId)).send(body);
  const statusOf = async (id: string) => (await prisma.space.findUnique({ where: { id } }))?.status;

  /** Crea un borrador con los datos que se le pasen; por defecto, completo salvo foto y horario. */
  const draft = async (extra: Record<string, unknown> = {}, userId = ownerId) => {
    const { body } = await request(server())
      .post('/api/spaces')
      .set(as(userId))
      .send({
        name: `Espacio ${SUFFIX}`,
        typeId,
        description: 'Sala luminosa',
        capacity: 10,
        communeId,
        pricePerHour: 12000,
        ...extra,
      })
      .expect(201);
    const id = (body as SpaceBody).id;
    spaceIds.push(id);
    return id;
  };
  const addPhoto = (id: string, userId = ownerId) =>
    request(server()).post(`/api/spaces/${id}/photos`).set(as(userId)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);
  const addSchedule = (id: string) =>
    prisma.availabilityRule.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ spaceId: id, weekday, startTime: '09:00', endTime: '21:00' })) });
  /** Un borrador listo para publicar. */
  const ready = async (extra: Record<string, unknown> = {}, userId = ownerId) => {
    const id = await draft(extra, userId);
    await addPhoto(id, userId);
    await addSchedule(id);
    return id;
  };

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
    await prisma.space.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    for (const id of spaceIds) await rm(join(uploadsDir(), 'spaces', id), { recursive: true, force: true });
    await app.close();
  });

  describe('POST /api/spaces/:id/publish', () => {
    it('un borrador vacío responde 409 con todo lo que falta', async () => {
      const { body } = await request(server()).post('/api/spaces').set(as(ownerId)).send({ name: `Vacío ${SUFFIX}` }).expect(201);
      const id = (body as SpaceBody).id;
      spaceIds.push(id);

      const response = await publish(id).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Faltan datos para publicar el espacio',
        missing: ['type', 'description', 'capacity', 'commune', 'price', 'photos', 'schedule'],
      });
      expect(await statusOf(id)).toBe('DRAFT');
    });

    it('va indicando lo que falta a medida que se completa', async () => {
      const id = await draft();
      expect((await publish(id).expect(409)).body.missing).toEqual(['photos', 'schedule']);

      await addPhoto(id);
      expect((await publish(id).expect(409)).body.missing).toEqual(['schedule']);

      await addSchedule(id);
      await publish(id).expect(200);
    });

    it.each([
      ['type', { typeId: null }],
      ['description', { description: null }],
      ['capacity', { capacity: null }],
      ['commune', { communeId: null }],
      ['price', { pricePerHour: null }],
    ])('exige %s', async (field, override) => {
      const id = await ready();
      await patch(id, override).expect(200);

      expect((await publish(id).expect(409)).body.missing).toEqual([field]);
    });

    it('publica: el espacio queda activo y la cuenta pasa a ser propietaria', async () => {
      // Una cuenta nueva, para ver el cambio de isHost (el propietario de los demás tests ya publicó).
      const fresh = await prisma.user.create({
        data: { email: `fresh-${SUFFIX}@rentsmart.test`, passwordHash: 'x', name: 'Nueva' },
      });
      try {
        const id = await ready({}, fresh.id);
        expect((await prisma.user.findUnique({ where: { id: fresh.id } }))?.isHost).toBe(false);

        const { body } = await publish(id, fresh.id).expect(200);

        expect((body as SpaceBody).status).toBe('ACTIVE');
        expect(await statusOf(id)).toBe('ACTIVE');
        expect((await prisma.user.findUnique({ where: { id: fresh.id } }))?.isHost).toBe(true);
      } finally {
        await prisma.space.deleteMany({ where: { ownerId: fresh.id } });
        await prisma.user.delete({ where: { id: fresh.id } });
      }
    });

    it('publicar solo con precio por día también vale', async () => {
      const id = await ready({ pricePerHour: undefined, pricePerDay: 80000 });

      await publish(id).expect(200);
    });

    it('un espacio ya publicado, desactivado o bloqueado no se publica de nuevo', async () => {
      const id = await ready();
      await publish(id).expect(200);
      expect((await publish(id).expect(409)).body.message).toBe('El espacio ya está publicado');

      await setStatus(id, 'INACTIVE').expect(200);
      expect((await publish(id).expect(409)).body.message).toContain('desactivado');

      await prisma.space.update({ where: { id }, data: { status: 'BLOCKED' } });
      await publish(id).expect(403);
    });

    it('responde 403 a otro usuario, 404 si no existe y 401 con un usuario inválido', async () => {
      const id = await ready();

      await publish(id, otherId).expect(403);
      await publish('no-existe').expect(404);
      await publish(id, 'no-existe').expect(401);
      expect(await statusOf(id)).toBe('DRAFT');
    });

    it('con varias peticiones a la vez publica una sola vez', async () => {
      const id = await ready();

      const results = await Promise.all(Array.from({ length: 8 }, () => publish(id)));

      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(7);
      expect(await statusOf(id)).toBe('ACTIVE');
    });
  });

  describe('PATCH /api/spaces/:id/status', () => {
    it('desactiva y vuelve a activar un espacio publicado', async () => {
      const id = await ready();
      await publish(id).expect(200);

      const off = await setStatus(id, 'INACTIVE').expect(200);
      expect((off.body as SpaceBody).status).toBe('INACTIVE');
      expect(await statusOf(id)).toBe('INACTIVE');

      const on = await setStatus(id, 'ACTIVE').expect(200);
      expect((on.body as SpaceBody).status).toBe('ACTIVE');
      expect(await statusOf(id)).toBe('ACTIVE');
    });

    it('pedir el estado que ya tiene no hace nada', async () => {
      const id = await ready();
      await publish(id).expect(200);

      await setStatus(id, 'ACTIVE').expect(200);
      await setStatus(id, 'INACTIVE').expect(200);
      await setStatus(id, 'INACTIVE').expect(200);
      expect(await statusOf(id)).toBe('INACTIVE');
    });

    it('un borrador no se activa ni se desactiva por aquí', async () => {
      const id = await ready();

      await setStatus(id, 'ACTIVE').expect(409);
      await setStatus(id, 'INACTIVE').expect(409);
      expect(await statusOf(id)).toBe('DRAFT');
    });

    it('no reactiva un espacio que quedó incompleto mientras estaba desactivado', async () => {
      const id = await ready();
      await publish(id).expect(200);
      await setStatus(id, 'INACTIVE').expect(200);
      await patch(id, { pricePerHour: null }).expect(200); // desactivado, puede quedar incompleto

      const { body } = await setStatus(id, 'ACTIVE').expect(409);

      expect((body as { missing: string[] }).missing).toEqual(['price']);
      expect(await statusOf(id)).toBe('INACTIVE');
    });

    it('un espacio bloqueado por un administrador no se puede cambiar', async () => {
      const id = await ready();
      await prisma.space.update({ where: { id }, data: { status: 'BLOCKED' } });

      await setStatus(id, 'ACTIVE').expect(403);
      await setStatus(id, 'INACTIVE').expect(403);
      expect(await statusOf(id)).toBe('BLOCKED');
    });

    it.each(['DRAFT', 'BLOCKED', 'PENDING', '', null, 42])('no acepta el estado %j', async (status) => {
      const id = await ready();

      await setStatus(id, status).expect(400);
    });

    it('responde 403 a otro usuario y 404 si no existe', async () => {
      const id = await ready();
      await publish(id).expect(200);

      await setStatus(id, 'INACTIVE', otherId).expect(403);
      await setStatus('no-existe', 'INACTIVE').expect(404);
      expect(await statusOf(id)).toBe('ACTIVE');
    });
  });

  describe('un espacio publicado sigue cumpliendo lo necesario', () => {
    let id: string;

    beforeEach(async () => {
      id = await ready();
      await publish(id).expect(200);
    });

    it('un cambio de precio, de nombre o de reglas vale', async () => {
      await patch(id, { pricePerHour: 15000, name: 'Otro nombre', rules: 'Sin ruido' }).expect(200);
      await patch(id, { pricePerHour: null, pricePerDay: 90000 }).expect(200);
    });

    it.each([
      ['price', { pricePerHour: null }],
      ['description', { description: null }],
      ['capacity', { capacity: null }],
      ['type', { typeId: null }],
      ['commune', { communeId: null }],
    ])('no deja quedarse sin %s y no cambia nada', async (field, override) => {
      const { body } = await patch(id, override).expect(409);

      expect((body as { missing: string[] }).missing).toEqual([field]);
      expect(await statusOf(id)).toBe('ACTIVE');
      const saved = await prisma.space.findUnique({ where: { id } });
      expect(saved?.pricePerHour).toBe(12000);
    });

    it('no deja borrar la última foto, pero sí una de varias', async () => {
      const first = (await request(server()).get(`/api/spaces/${id}`).set(as(ownerId)).expect(200)).body.photos[0].id as string;
      const del = (photoId: string) => request(server()).delete(`/api/spaces/${id}/photos/${photoId}`).set(as(ownerId));

      const { body } = await del(first).expect(409);
      expect((body as { missing: string[] }).missing).toEqual(['photos']);

      const second = (await addPhoto(id)).body.id as string;
      await del(first).expect(204);
      await del(second).expect(409);
    });

    it('si se desactiva primero, sí se puede dejar incompleto', async () => {
      await setStatus(id, 'INACTIVE').expect(200);

      await patch(id, { description: null }).expect(200);
    });
  });
});
