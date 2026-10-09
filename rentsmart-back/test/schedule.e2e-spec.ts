import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-sch-${Date.now()}`;

interface Rule {
  weekday: number;
  startTime: string;
  endTime: string;
}
const rule = (weekday: number, startTime: string, endTime: string): Rule => ({ weekday, startTime, endTime });
const WEEKDAYS = [1, 2, 3, 4, 5].map((weekday) => rule(weekday, '09:00', '21:00'));

describe('Horario semanal (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;

  const server = () => app.getHttpServer();
  const as = (userId: string) => bearer(app, userId);
  const get = (spaceId: string, userId = ownerId) =>
    request(server()).get(`/api/spaces/${spaceId}/schedule`).set(as(userId));
  const put = (spaceId: string, rules: unknown, userId = ownerId) =>
    request(server()).put(`/api/spaces/${spaceId}/schedule`).set(as(userId)).send({ rules });
  const stored = (spaceId: string) =>
    prisma.availabilityRule.findMany({
      where: { spaceId },
      select: { weekday: true, startTime: true, endTime: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });

  let counter = 0;
  /** Un espacio del propietario en el estado pedido, con el horario dado. */
  const space = async (status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' = 'DRAFT', rules: Rule[] = []) => {
    counter += 1;
    const created = await prisma.space.create({
      data: { ownerId, name: `Espacio ${counter} ${SUFFIX}`, status, rulesWeek: { create: rules } },
    });
    return created.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key } });
    ownerId = (await user('owner')).id;
    otherId = (await user('other')).id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { renterId: otherId } });
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await app.close();
  });

  describe('GET /api/spaces/:id/schedule', () => {
    it('un borrador nuevo no tiene horario', async () => {
      const id = await space();

      const { body } = await get(id).expect(200);

      expect(body).toEqual({ rules: [] });
    });

    it('devuelve el horario por día y hora de inicio, solo con los campos del contrato', async () => {
      const id = await space('ACTIVE', [rule(3, '15:00', '18:00'), rule(1, '09:00', '13:00'), rule(3, '09:00', '13:00')]);

      const { body } = await get(id).expect(200);

      expect(body).toEqual({ rules: [rule(1, '09:00', '13:00'), rule(3, '09:00', '13:00'), rule(3, '15:00', '18:00')] });
    });

    it('responde 401 sin sesión, 403 si el espacio es de otro y 404 si no existe', async () => {
      const id = await space();

      await request(server()).get(`/api/spaces/${id}/schedule`).expect(401);
      await get(id, otherId).expect(403);
      await get('no-existe').expect(404);
    });
  });

  describe('PUT /api/spaces/:id/schedule', () => {
    it('guarda el horario de un borrador y lo devuelve ordenado', async () => {
      const id = await space();

      const { body } = await put(id, [...WEEKDAYS].reverse()).expect(200);

      expect(body).toEqual({ rules: WEEKDAYS });
      expect(await stored(id)).toEqual(WEEKDAYS);
      expect((await get(id).expect(200)).body).toEqual({ rules: WEEKDAYS });
    });

    it('reemplaza el horario completo: lo anterior desaparece', async () => {
      const id = await space('ACTIVE', WEEKDAYS);

      await put(id, [rule(6, '10:00', '14:00')]).expect(200);

      expect(await stored(id)).toEqual([rule(6, '10:00', '14:00')]);
    });

    it('acepta varios rangos en un día, contiguos y hasta las 24:00', async () => {
      const id = await space();
      const rules = [rule(0, '00:00', '24:00'), rule(5, '09:00', '13:00'), rule(5, '13:00', '18:00'), rule(5, '20:00', '24:00')];

      const { body } = await put(id, rules).expect(200);

      expect(body).toEqual({ rules });
      expect(await stored(id)).toEqual(rules);
    });

    it('con horario, al borrador ya no le falta el horario para publicarse', async () => {
      const id = await space();
      const missing = async () => {
        const { body } = await request(server()).get('/api/spaces/me').set(as(ownerId)).expect(200);
        return (body as Array<{ id: string; missing: string[] }>).find((item) => item.id === id)!.missing;
      };
      expect(await missing()).toContain('schedule');

      await put(id, WEEKDAYS).expect(200);

      expect(await missing()).not.toContain('schedule');
    });

    it.each([
      ['un fin igual al inicio', [rule(1, '09:00', '09:00')]],
      ['un fin anterior al inicio', [rule(1, '18:00', '09:00')]],
      ['dos rangos del mismo día que se traslapan', [rule(1, '09:00', '13:00'), rule(1, '12:00', '18:00')]],
      ['el mismo rango repetido', [rule(1, '09:00', '13:00'), rule(1, '09:00', '13:00')]],
      ['una hora que no es cerrada', [rule(1, '09:30', '13:00')]],
      ['un día que no existe', [rule(7, '09:00', '13:00')]],
    ])('responde 400 con %s y conserva el horario anterior', async (_name, rules) => {
      const id = await space('DRAFT', WEEKDAYS);

      const { body } = await put(id, rules).expect(400);

      expect((body as { message: unknown }).message).toBeDefined();
      expect(await stored(id)).toEqual(WEEKDAYS);
    });

    it('responde 401 sin sesión, 403 si el espacio es de otro y 404 si no existe, sin cambiar nada', async () => {
      const id = await space('DRAFT', WEEKDAYS);

      await request(server()).put(`/api/spaces/${id}/schedule`).send({ rules: [] }).expect(401);
      await put(id, [], otherId).expect(403);
      await put('no-existe', WEEKDAYS).expect(404);

      expect(await stored(id)).toEqual(WEEKDAYS);
    });

    it('responde 409 con missing si deja sin horario a un espacio publicado, y lo conserva', async () => {
      const id = await space('ACTIVE', WEEKDAYS);

      const { body } = await put(id, []).expect(409);

      expect(body).toMatchObject({ statusCode: 409, error: 'Conflict', missing: ['schedule'] });
      expect(await stored(id)).toEqual(WEEKDAYS);
    });

    it('un borrador y un espacio desactivado sí pueden quedar sin horario', async () => {
      const draft = await space('DRAFT', WEEKDAYS);
      const inactive = await space('INACTIVE', WEEKDAYS);

      await put(draft, []).expect(200);
      await put(inactive, []).expect(200);

      expect(await stored(draft)).toEqual([]);
      expect(await stored(inactive)).toEqual([]);
    });

    it('cambiar el horario no toca las reservas que ya existen', async () => {
      const id = await space('ACTIVE', WEEKDAYS);
      // Lunes 12 de octubre de 2026, de 10:00 a 12:00 en Chile.
      const booking = await prisma.booking.create({
        data: {
          spaceId: id,
          renterId: otherId,
          startAt: new Date('2026-10-12T13:00:00Z'),
          endAt: new Date('2026-10-12T15:00:00Z'),
          unit: 'HOUR',
          subtotal: 24000,
          fee: 2400,
          total: 26400,
          status: 'CONFIRMED',
        },
      });

      // El nuevo horario ya no incluye los lunes.
      await put(id, [rule(6, '10:00', '14:00')]).expect(200);

      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CONFIRMED');
      expect(after.startAt).toEqual(booking.startAt);
      expect(after.endAt).toEqual(booking.endAt);
    });
  });
});
