import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-adm-${Date.now()}`;

interface AdminSpace {
  id: string;
  name: string;
  status: string;
  ownerName: string;
  ownerEmail: string;
  blockedReason: string | null;
  blockedAt: string | null;
  [key: string]: unknown;
}
interface Page {
  items: AdminSpace[];
  total: number;
  page: number;
  pageSize: number;
}

describe('Administración de espacios y tipos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminId: string;
  let ownerId: string;
  let regionId: number;
  let communeId: number;
  let typeId: number;
  const ids: Record<string, string> = {};
  const createdTypeIds: number[] = [];

  const as = (userId: string) => bearer(app, userId);
  const server = () => app.getHttpServer();
  const asAdmin = () => as(adminId);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string, role: 'USER' | 'ADMIN' = 'USER') =>
      prisma.user.create({
        data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: `Nombre ${key}`, role },
      });
    adminId = (await user('admin', 'ADMIN')).id;
    ownerId = (await user('owner')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;

    const space = async (key: string, status: string) => {
      const created = await prisma.space.create({
        data: {
          ownerId,
          typeId,
          regionId,
          communeId,
          name: `${key} ${SUFFIX}`,
          status: status as never,
          description: 'Sala luminosa',
          capacity: 10,
          pricePerHour: 12000,
          photos: { create: { storagePath: `spaces/x/${key}-${SUFFIX}.jpg`, url: 'https://fotos.test/a.jpg', position: 0 } },
          rulesWeek: { create: { weekday: 1, startTime: '09:00', endTime: '21:00' } },
        },
      });
      ids[key] = created.id;
    };
    await space('Activo', 'ACTIVE');
    await space('Inactivo', 'INACTIVE');
    await space('Borrador', 'DRAFT');
    await space('Otro', 'ACTIVE');
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, ownerId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.deleteMany({ where: { id: { in: [typeId, ...createdTypeIds] } } });
    await app.close();
  });

  describe('permisos', () => {
    it.each([
      ['GET', '/api/admin/spaces'],
      ['POST', '/api/admin/spaces/x/block'],
      ['POST', '/api/admin/spaces/x/unblock'],
      ['GET', '/api/admin/space-types'],
      ['POST', '/api/admin/space-types'],
      ['PATCH', '/api/admin/space-types/1'],
    ])('%s %s da 403 a un usuario común', async (method, path) => {
      const response = await request(server())[method.toLowerCase() as 'get'](path).set(as(ownerId)).send({ name: 'Algo', reason: 'Un motivo' });

      expect(response.status).toBe(403);
    });

    it('un usuario que no existe da 401', async () => {
      await request(server()).get('/api/admin/spaces').set(bearer(app, 'no-existe')).expect(401);
      await request(server()).get('/api/admin/space-types').set(bearer(app, 'no-existe')).expect(401);
    });
  });

  describe('GET /api/admin/spaces', () => {
    it('lista los espacios de cualquier propietario y estado, con su propietario', async () => {
      const { body } = (await request(server()).get(`/api/admin/spaces?q=${SUFFIX}`).set(asAdmin()).expect(200)) as { body: Page };

      expect(body.total).toBe(4);
      expect(body.items.map((s) => s.status).sort()).toEqual(['ACTIVE', 'ACTIVE', 'DRAFT', 'INACTIVE']);
      expect(body.items[0]).toMatchObject({ ownerName: 'Nombre owner', ownerEmail: `owner-${SUFFIX}@rentsmart.test`, typeName: `Tipo ${SUFFIX}`, communeName: `Comuna ${SUFFIX}`, blockedReason: null });
    });

    it('filtra por estado', async () => {
      const { body } = (await request(server()).get(`/api/admin/spaces?status=DRAFT&q=${SUFFIX}`).set(asAdmin()).expect(200)) as { body: Page };

      expect(body.items.map((s) => s.id)).toEqual([ids.Borrador]);
    });

    it('busca por el nombre del espacio, o por el nombre o el email del propietario, sin distinguir mayúsculas', async () => {
      const byName = (await request(server()).get(`/api/admin/spaces?q=${encodeURIComponent(`INACTIVO ${SUFFIX}`)}`).set(asAdmin()).expect(200)) as { body: Page };
      const byOwner = (await request(server()).get(`/api/admin/spaces?q=${encodeURIComponent(`owner-${SUFFIX}`.toUpperCase())}`).set(asAdmin()).expect(200)) as { body: Page };

      expect(byName.body.items.map((s) => s.id)).toEqual([ids.Inactivo]);
      expect(byOwner.body.total).toBe(4);
    });

    it('los comodines de la búsqueda se buscan como texto', async () => {
      const { body } = (await request(server()).get('/api/admin/spaces?q=%25').set(asAdmin()).expect(200)) as { body: Page };

      expect(body.items.every((s) => s.name.includes('%') || s.ownerName.includes('%') || s.ownerEmail.includes('%'))).toBe(true);
    });

    it('pagina', async () => {
      const first = (await request(server()).get(`/api/admin/spaces?q=${SUFFIX}&pageSize=3`).set(asAdmin()).expect(200)) as { body: Page };
      const second = (await request(server()).get(`/api/admin/spaces?q=${SUFFIX}&pageSize=3&page=2`).set(asAdmin()).expect(200)) as { body: Page };

      expect([first.body.items.length, second.body.items.length, first.body.total]).toEqual([3, 1, 4]);
    });

    it.each(['status=ACEPTADO', 'page=0', 'pageSize=51', 'orden=asc'])('rechaza %s con 400', async (query) => {
      await request(server()).get(`/api/admin/spaces?${query}`).set(asAdmin()).expect(400);
    });
  });

  describe('bloquear y desbloquear', () => {
    it('despublica un espacio con su motivo: sale del catálogo y el propietario ve el motivo', async () => {
      await request(server()).get(`/api/catalog/${ids.Activo}`).expect(200);

      const { body } = await request(server())
        .post(`/api/admin/spaces/${ids.Activo}/block`)
        .set(asAdmin())
        .send({ reason: '  Las fotos no corresponden al espacio  ' })
        .expect(200);

      expect(body).toMatchObject({ id: ids.Activo, status: 'BLOCKED', blockedReason: 'Las fotos no corresponden al espacio' });
      expect((body as AdminSpace).blockedAt).not.toBeNull();
      await request(server()).get(`/api/catalog/${ids.Activo}`).expect(404);
      const mine = await request(server()).get('/api/spaces/me').set(as(ownerId)).expect(200);
      expect((mine.body as AdminSpace[]).find((s) => s.id === ids.Activo)).toMatchObject({ status: 'BLOCKED', blockedReason: 'Las fotos no corresponden al espacio' });
      const detail = await request(server()).get(`/api/spaces/${ids.Activo}`).set(as(ownerId)).expect(200);
      expect(detail.body).toMatchObject({ blockedReason: 'Las fotos no corresponden al espacio' });
    });

    it('el propietario no puede activar un espacio bloqueado', async () => {
      await request(server()).patch(`/api/spaces/${ids.Activo}/status`).set(as(ownerId)).send({ status: 'ACTIVE' }).expect(403);
    });

    it('bloquear uno que ya está bloqueado da 409', async () => {
      await request(server()).post(`/api/admin/spaces/${ids.Activo}/block`).set(asAdmin()).send({ reason: 'Otra vez el motivo' }).expect(409);
    });

    it('desbloquear lo deja desactivado, sin motivo, y el propietario lo puede volver a activar', async () => {
      const { body } = await request(server()).post(`/api/admin/spaces/${ids.Activo}/unblock`).set(asAdmin()).expect(200);

      expect(body).toMatchObject({ status: 'INACTIVE', blockedReason: null, blockedAt: null });
      await request(server()).get(`/api/catalog/${ids.Activo}`).expect(404);
      await request(server()).patch(`/api/spaces/${ids.Activo}/status`).set(as(ownerId)).send({ status: 'ACTIVE' }).expect(200);
      await request(server()).get(`/api/catalog/${ids.Activo}`).expect(200);
    });

    it('desbloquear uno que no está bloqueado da 409', async () => {
      await request(server()).post(`/api/admin/spaces/${ids.Activo}/unblock`).set(asAdmin()).expect(409);
    });

    it('también se puede bloquear un espacio desactivado', async () => {
      const { body } = await request(server()).post(`/api/admin/spaces/${ids.Inactivo}/block`).set(asAdmin()).send({ reason: 'Publicidad engañosa' }).expect(200);

      expect(body).toMatchObject({ status: 'BLOCKED', blockedReason: 'Publicidad engañosa' });
    });

    it('un borrador no se bloquea: 409 y no cambia', async () => {
      await request(server()).post(`/api/admin/spaces/${ids.Borrador}/block`).set(asAdmin()).send({ reason: 'No debería poder' }).expect(409);

      expect((await prisma.space.findUniqueOrThrow({ where: { id: ids.Borrador } })).status).toBe('DRAFT');
    });

    it('un espacio que no existe da 404', async () => {
      await request(server()).post('/api/admin/spaces/no-existe/block').set(asAdmin()).send({ reason: 'Un motivo válido' }).expect(404);
      await request(server()).post('/api/admin/spaces/no-existe/unblock').set(asAdmin()).expect(404);
    });

    it.each([
      ['sin motivo', {}],
      ['con un motivo vacío', { reason: '   ' }],
      ['con un motivo muy corto', { reason: 'no' }],
      ['con un motivo larguísimo', { reason: 'x'.repeat(501) }],
      ['con un motivo que no es texto', { reason: 12345 }],
      ['con campos que no existen', { reason: 'Un motivo válido', status: 'ACTIVE' }],
    ])('rechaza bloquear %s con 400, y no cambia nada', async (_name, body) => {
      await request(server()).post(`/api/admin/spaces/${ids.Otro}/block`).set(asAdmin()).send(body).expect(400);

      expect((await prisma.space.findUniqueOrThrow({ where: { id: ids.Otro } })).status).toBe('ACTIVE');
    });

    it('las reservas confirmadas de un espacio bloqueado se mantienen', async () => {
      const renter = await prisma.user.create({ data: { email: `renter-${SUFFIX}@rentsmart.test`, passwordHash: 'x', name: 'Arrendatario' } });
      const booking = await prisma.booking.create({
        data: {
          spaceId: ids.Otro,
          renterId: renter.id,
          startAt: new Date('2099-03-02T16:00:00Z'),
          endAt: new Date('2099-03-02T19:00:00Z'),
          unit: 'HOUR',
          subtotal: 36000,
          fee: 3600,
          total: 39600,
          status: 'CONFIRMED',
        },
      });

      await request(server()).post(`/api/admin/spaces/${ids.Otro}/block`).set(asAdmin()).send({ reason: 'Contenido inapropiado' }).expect(200);

      expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'CONFIRMED', total: 39600 });
      await prisma.booking.delete({ where: { id: booking.id } });
      await prisma.user.delete({ where: { id: renter.id } });
    });
  });

  describe('tipos de espacio', () => {
    const create = (name: unknown) => request(server()).post('/api/admin/space-types').set(asAdmin()).send({ name });
    const rename = (id: number | string, name: unknown) => request(server()).patch(`/api/admin/space-types/${id}`).set(asAdmin()).send({ name });

    it('lista los tipos con cuántos espacios usa cada uno', async () => {
      const { body } = await request(server()).get('/api/admin/space-types').set(asAdmin()).expect(200);

      expect((body as Array<{ id: number; name: string; spaces: number }>).find((t) => t.id === typeId)).toEqual({ id: typeId, name: `Tipo ${SUFFIX}`, spaces: 4 });
    });

    it('crea un tipo, lo deja en la lista pública y le quita los espacios de más al nombre', async () => {
      const { body } = await create(`  Estudio   de danza ${SUFFIX} `).expect(201);
      createdTypeIds.push((body as { id: number }).id);

      expect(body).toMatchObject({ name: `Estudio de danza ${SUFFIX}`, spaces: 0 });
      const publicList = await request(server()).get('/api/space-types').expect(200);
      expect((publicList.body as Array<{ name: string }>).map((t) => t.name)).toContain(`Estudio de danza ${SUFFIX}`);
    });

    it('renombra un tipo', async () => {
      const created = (await create(`Salón ${SUFFIX}`).expect(201)).body as { id: number };
      createdTypeIds.push(created.id);

      const { body } = await rename(created.id, `Salón de fiestas ${SUFFIX}`).expect(200);

      expect(body).toEqual({ id: created.id, name: `Salón de fiestas ${SUFFIX}`, spaces: 0 });
    });

    it('renombrar un tipo con espacios no los toca', async () => {
      const created = (await create(`Taller ${SUFFIX}`).expect(201)).body as { id: number };
      createdTypeIds.push(created.id);
      const space = await prisma.space.create({ data: { ownerId, typeId: created.id, name: `Con tipo ${SUFFIX}` } });

      const { body } = await rename(created.id, `Taller de arte ${SUFFIX}`).expect(200);

      expect(body).toMatchObject({ spaces: 1 });
      expect((await prisma.space.findUniqueOrThrow({ where: { id: space.id } })).typeId).toBe(created.id);
    });

    it('un nombre repetido da 409, sin distinguir mayúsculas ni tildes', async () => {
      const created = (await create(`Cancha ${SUFFIX}`).expect(201)).body as { id: number };
      createdTypeIds.push(created.id);

      await create(`CANCHA ${SUFFIX}`).expect(409);
      await create(`Cáncha ${SUFFIX}`).expect(409);
      await rename(typeId, `cancha ${SUFFIX}`).expect(409);
    });

    it('renombrar un tipo con su propio nombre (cambiando solo las mayúsculas) es válido', async () => {
      const created = (await create(`Bodega ${SUFFIX}`).expect(201)).body as { id: number };
      createdTypeIds.push(created.id);

      await rename(created.id, `BODEGA ${SUFFIX}`).expect(200);
    });

    it.each(['Alojamiento por noche', 'Hotel boutique', 'Cabañas', 'Departamento amoblado', 'Habitación individual', 'HOSPEDAJE'])('no deja crear un alojamiento: %s', async (name) => {
      await create(name).expect(400);
    });

    it('no deja renombrar un tipo a un alojamiento', async () => {
      await rename(typeId, 'Casa de huéspedes hotel').expect(400);
    });

    it('una palabra parecida pero válida sí pasa ("Casona" no es "casa" ni un alojamiento)', async () => {
      const created = (await create(`Casona de eventos ${SUFFIX}`).expect(201)).body as { id: number };
      createdTypeIds.push(created.id);
    });

    it.each([
      ['sin nombre', undefined],
      ['con un nombre de una letra', 'a'],
      ['con un nombre en blanco', '    '],
      ['con un nombre larguísimo', 'x'.repeat(61)],
      ['con un nombre que no es texto', 99],
    ])('rechaza crear %s con 400', async (_name, name) => {
      await create(name).expect(400);
    });

    it('renombrar uno que no existe da 404, también con un id fuera de rango', async () => {
      await rename(999999, 'Un nombre válido').expect(404);
      await rename(99999999999, 'Un nombre válido').expect(404);
      await rename('abc', 'Un nombre válido').expect(400);
    });
  });
});
