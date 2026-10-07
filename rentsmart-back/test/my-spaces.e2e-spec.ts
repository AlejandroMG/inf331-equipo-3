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
const SUFFIX = `e2e-me-${Date.now()}`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface Summary {
  id: string;
  status: string;
  name: string;
  [key: string]: unknown;
}

describe('Mis espacios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  let emptyUserId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;
  const spaceIds: string[] = [];

  const as = (userId: string) => bearer(app, userId);
  const server = () => app.getHttpServer();
  const mine = async (userId = ownerId) =>
    (await request(server()).get('/api/spaces/me').set(as(userId)).expect(200)).body as Summary[];

  const create = async (body: Record<string, unknown>, userId = ownerId) => {
    const { body: created } = await request(server()).post('/api/spaces').set(as(userId)).send(body).expect(201);
    const id = (created as Summary).id;
    spaceIds.push(id);
    return id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    otherId = (await user('other')).id;
    emptyUserId = (await user('empty')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;
  });

  afterAll(async () => {
    const users = [ownerId, otherId, emptyUserId];
    await prisma.space.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    for (const id of spaceIds) await rm(join(uploadsDir(), 'spaces', id), { recursive: true, force: true });
    await app.close();
  });

  it('sin espacios devuelve una lista vacía', async () => {
    expect(await mine(emptyUserId)).toEqual([]);
  });

  it('"me" no se confunde con el id de un espacio', async () => {
    await request(server()).get('/api/spaces/me').set(as(ownerId)).expect(200);
    await request(server()).get('/api/spaces/no-existe').set(as(ownerId)).expect(404);
  });

  it('responde 401 con un usuario inválido', () => {
    return request(server()).get('/api/spaces/me').set(as('no-existe')).expect(401);
  });

  it('lista solo los espacios del usuario, de cualquier estado, los modificados más recientemente primero', async () => {
    const first = await create({ name: `Primero ${SUFFIX}` });
    const second = await create({ name: `Segundo ${SUFFIX}` });
    const third = await create({ name: `Tercero ${SUFFIX}` });
    await create({ name: `Ajeno ${SUFFIX}` }, otherId);
    await prisma.space.update({ where: { id: second }, data: { status: 'INACTIVE' } });
    await prisma.space.update({ where: { id: third }, data: { status: 'BLOCKED' } });
    // Se toca el primero para que sea el más reciente.
    await request(server()).patch(`/api/spaces/${first}`).set(as(ownerId)).send({ description: 'Cambio' }).expect(200);

    const list = await mine();

    expect(list.map((s) => [s.id, s.status])).toEqual([
      [first, 'DRAFT'],
      [third, 'BLOCKED'],
      [second, 'INACTIVE'],
    ]);
    expect(list.map((s) => s.name)).not.toContain(`Ajeno ${SUFFIX}`);
  });

  it('cada espacio trae solo el resumen del contrato, sin datos privados', async () => {
    const id = await create({
      name: `Resumen ${SUFFIX}`,
      typeId,
      communeId,
      pricePerHour: 12000,
      description: 'Luminosa',
      capacity: 8,
      address: 'Av. Pública 1',
      addressDetail: 'Oficina secreta',
    });
    await request(server()).post(`/api/spaces/${id}/photos`).set(as(ownerId)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);

    const summary = (await mine()).find((s) => s.id === id)!;

    expect(summary).toEqual({
      id,
      status: 'DRAFT',
      name: `Resumen ${SUFFIX}`,
      typeName: `Tipo ${SUFFIX}`,
      communeName: `Comuna ${SUFFIX}`,
      pricePerHour: 12000,
      pricePerDay: null,
      coverUrl: expect.stringMatching(/^\/api\/uploads\/spaces\/.+\.png$/),
      missing: ['schedule'],
      blockedReason: null,
      updatedAt: expect.any(String),
    });
    const { text } = await request(server()).get('/api/spaces/me').set(as(ownerId)).expect(200);
    expect(text).not.toContain('Oficina secreta');
    expect(text).not.toContain('ownerId');
  });

  it('indica lo que le falta a cada borrador, y nada si está completo', async () => {
    const empty = await create({ name: `Vacío ${SUFFIX}` });
    const complete = await create({ name: `Completo ${SUFFIX}`, typeId, communeId, pricePerDay: 50000, description: 'x', capacity: 4 });
    await request(server()).post(`/api/spaces/${complete}/photos`).set(as(ownerId)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    await prisma.availabilityRule.create({ data: { spaceId: complete, weekday: 1, startTime: '09:00', endTime: '21:00' } });

    const list = await mine();

    expect(list.find((s) => s.id === empty)?.missing).toEqual(['type', 'description', 'capacity', 'commune', 'price', 'photos', 'schedule']);
    expect(list.find((s) => s.id === complete)?.missing).toEqual([]);
  });

  it('un espacio sin fotos tiene la portada en null', async () => {
    const id = await create({ name: `Sin fotos ${SUFFIX}` });

    expect((await mine()).find((s) => s.id === id)?.coverUrl).toBeNull();
  });
});
