import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-own-${Date.now()}`;
const HOUR = 3_600_000;

interface BookingItem {
  id: string;
  spaceName: string;
  renterName: string;
  startAt: string;
  subtotal: number;
  status: string;
  contact: { email: string; phone: string | null } | null;
  [key: string]: unknown;
}
interface BookingsBody {
  items: BookingItem[];
  total: number;
  page: number;
  pageSize: number;
}
interface MetricsBody {
  month: string;
  income: number;
  bookings: number;
  spaces: Array<Record<string, unknown> & { name: string }>;
}

describe('Panel del propietario (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherOwnerId: string;
  let renterId: string;
  let regionId: number;
  let communeId: number;
  let typeId: number;
  const ids: Record<string, string> = {};
  const bookingIds: Record<string, string> = {};

  const as = (userId: string) => ({ 'x-user-id': userId });
  const server = () => app.getHttpServer();
  const bookings = (query = '', userId = ownerId) => request(server()).get(`/api/owner/bookings${query}`).set(as(userId));
  const metrics = (query = '', userId = ownerId) => request(server()).get(`/api/owner/metrics${query}`).set(as(userId));

  /** Una reserva de `hours` horas desde un instante UTC. */
  const book = async (key: string, spaceId: string, startUtc: string, hours: number, status: string, subtotal: number) => {
    const startAt = new Date(startUtc);
    const booking = await prisma.booking.create({
      data: {
        spaceId,
        renterId,
        startAt,
        endAt: new Date(startAt.getTime() + hours * HOUR),
        unit: 'HOUR',
        subtotal,
        fee: Math.round(subtotal / 10),
        total: subtotal + Math.round(subtotal / 10),
        status: status as never,
      },
    });
    bookingIds[key] = booking.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string, phone: string | null = null) =>
      prisma.user.create({ data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: `Nombre ${key}`, phone } });
    ownerId = (await user('owner')).id;
    otherOwnerId = (await user('other')).id;
    renterId = (await user('renter', '+56 9 1234 5678')).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;

    const space = async (key: string, owner: string, status: string, rules: Array<[number, string, string]> = []) => {
      const created = await prisma.space.create({
        data: {
          ownerId: owner,
          typeId,
          regionId,
          communeId,
          name: `${key} ${SUFFIX}`,
          status: status as never,
          rulesWeek: { create: rules.map(([weekday, startTime, endTime]) => ({ weekday, startTime, endTime })) },
        },
      });
      ids[key] = created.id;
    };
    // Octubre de 2026 tiene 4 lunes y 5 sábados: 4 × 12 h + 5 × 4 h = 68 h arrendables.
    await space('Sala', ownerId, 'ACTIVE', [[1, '09:00', '21:00'], [6, '10:00', '14:00']]);
    await space('Taller', ownerId, 'INACTIVE');
    await space('Borrador', ownerId, 'DRAFT');
    await space('Ajeno', otherOwnerId, 'ACTIVE', [[1, '09:00', '21:00']]);

    // Hora de Chile en octubre: UTC-3 (13:00 local = 16:00 UTC).
    await book('confirmada', ids.Sala, '2026-10-05T16:00:00Z', 3, 'CONFIRMED', 36000);
    await book('finalizada', ids.Sala, '2026-10-12T13:00:00Z', 2, 'FINISHED', 24000);
    await book('pendiente', ids.Sala, '2026-10-19T14:00:00Z', 1, 'PENDING', 12000);
    await book('cancelada', ids.Sala, '2026-10-20T14:00:00Z', 1, 'CANCELLED', 12000);
    await book('septiembre', ids.Sala, '2026-09-28T16:00:00Z', 1, 'CONFIRMED', 12000);
    // El 31 de octubre a las 23:00 de Chile (02:00 UTC del 1 de noviembre): todavía es octubre.
    await book('fin-de-mes', ids.Sala, '2026-11-01T02:00:00Z', 1, 'CONFIRMED', 12000);
    // El 1 de noviembre a las 00:30 de Chile: ya es noviembre.
    await book('noviembre', ids.Sala, '2026-11-01T03:30:00Z', 1, 'CONFIRMED', 12000);
    // Una reserva a las 23:30 del 3 de octubre en Chile (02:30 UTC del 4): el día es el 3, no el 4.
    await book('noche', ids.Taller, '2026-10-04T02:30:00Z', 1, 'CONFIRMED', 9000);
    await book('ajena', ids.Ajeno, '2026-10-05T16:00:00Z', 3, 'CONFIRMED', 99000);
  });

  afterAll(async () => {
    const spaceIds = Object.values(ids);
    await prisma.booking.deleteMany({ where: { spaceId: { in: spaceIds } } });
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherOwnerId, renterId] } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  describe('sin sesión', () => {
    it('un usuario que no existe da 401', async () => {
      await request(server()).get('/api/owner/bookings').set({ 'x-user-id': 'no-existe' }).expect(401);
      await request(server()).get('/api/owner/metrics').set({ 'x-user-id': 'no-existe' }).expect(401);
    });
  });

  describe('GET /api/owner/bookings', () => {
    it('lista las reservas de mis espacios, las más lejanas primero, y nunca las de otro propietario', async () => {
      const { body } = (await bookings().expect(200)) as { body: BookingsBody };

      expect(body.total).toBe(8);
      expect(body.items.map((i) => i.id)).not.toContain(bookingIds.ajena);
      const starts = body.items.map((i) => i.startAt);
      expect(starts).toEqual([...starts].sort().reverse());
      expect(body).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('cada reserva trae el espacio, el arrendatario, el horario y lo que recibe el propietario', async () => {
      const { body } = (await bookings('?status=FINISHED').expect(200)) as { body: BookingsBody };

      expect(body.items).toEqual([
        {
          id: bookingIds.finalizada,
          spaceId: ids.Sala,
          spaceName: `Sala ${SUFFIX}`,
          renterName: 'Nombre renter',
          startAt: '2026-10-12T13:00:00.000Z',
          endAt: '2026-10-12T15:00:00.000Z',
          unit: 'HOUR',
          subtotal: 24000,
          status: 'FINISHED',
          contact: null,
        },
      ]);
    });

    it('el contacto del arrendatario solo viene en las reservas confirmadas', async () => {
      const { body } = (await bookings().expect(200)) as { body: BookingsBody };

      for (const item of body.items) {
        if (item.status === 'CONFIRMED') {
          expect(item.contact).toEqual({ email: `renter-${SUFFIX}@rentsmart.test`, phone: '+56 9 1234 5678' });
        } else {
          expect(item.contact).toBeNull();
        }
      }
      expect(body.items.some((i) => i.status === 'CONFIRMED')).toBe(true);
      expect(JSON.stringify(body.items.filter((i) => i.status !== 'CONFIRMED'))).not.toContain('rentsmart.test');
    });

    it('filtra por estado', async () => {
      const { body } = (await bookings('?status=CONFIRMED').expect(200)) as { body: BookingsBody };

      expect(body.items.every((i) => i.status === 'CONFIRMED')).toBe(true);
      expect(body.total).toBe(5);
    });

    it('filtra por fecha, con el día final incluido', async () => {
      const { body } = (await bookings('?from=2026-10-05&to=2026-10-12&sort=asc').expect(200)) as { body: BookingsBody };

      expect(body.items.map((i) => i.id)).toEqual([bookingIds.confirmada, bookingIds.finalizada]);
    });

    it('los días son los de Chile: una reserva a las 23:30 del 3 queda en el 3 y no en el 4', async () => {
      const third = (await bookings('?from=2026-10-03&to=2026-10-03').expect(200)) as { body: BookingsBody };
      const fourth = (await bookings('?from=2026-10-04&to=2026-10-04').expect(200)) as { body: BookingsBody };

      expect(third.body.items.map((i) => i.id)).toEqual([bookingIds.noche]);
      expect(fourth.body.items).toEqual([]);
    });

    it('con solo una de las fechas, la otra queda abierta', async () => {
      const { body } = (await bookings('?from=2026-10-20').expect(200)) as { body: BookingsBody };

      expect(body.items.every((i) => i.startAt >= '2026-10-20')).toBe(true);
    });

    it('combina estado y fecha', async () => {
      const { body } = (await bookings('?status=CONFIRMED&from=2026-10-01&to=2026-10-31').expect(200)) as { body: BookingsBody };

      expect(body.items.map((i) => i.id).sort()).toEqual([bookingIds.confirmada, bookingIds['fin-de-mes'], bookingIds.noche].sort());
    });

    it('ordena de la más próxima a la más lejana con sort=asc', async () => {
      const { body } = (await bookings('?sort=asc').expect(200)) as { body: BookingsBody };

      const starts = body.items.map((i) => i.startAt);
      expect(starts).toEqual([...starts].sort());
      expect(body.items[0].id).toBe(bookingIds.septiembre);
    });

    it('pagina', async () => {
      const first = (await bookings('?pageSize=3&sort=asc').expect(200)) as { body: BookingsBody };
      const last = (await bookings('?pageSize=3&page=3&sort=asc').expect(200)) as { body: BookingsBody };

      expect(first.body.items).toHaveLength(3);
      expect(last.body.items).toHaveLength(2);
      expect([first.body.total, last.body.total, last.body.page]).toEqual([8, 8, 3]);
    });

    it('un propietario sin reservas recibe una página vacía', async () => {
      const { body } = await bookings('', renterId).expect(200);

      expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });

    it.each([
      'status=ACEPTADA',
      'page=0',
      'pageSize=51',
      'pageSize=abc',
      'from=2026-13-01',
      'from=03-10-2026',
      'from=2026-02-31',
      'to=2026-04-31',
      'from=2026-10-10&to=2026-10-09',
      'sort=random',
      'q=sala',
    ])('rechaza %s con 400', async (query) => {
      await bookings(`?${query}`).expect(400);
    });
  });

  describe('GET /api/owner/metrics', () => {
    it('suma los ingresos de las reservas confirmadas y finalizadas que empiezan en el mes', async () => {
      const { body } = (await metrics('?month=2026-10').expect(200)) as { body: MetricsBody };

      // Confirmada (36.000) + finalizada (24.000) + la del 31 a las 23:00 (12.000) + la de la noche del 3 en el Taller (9.000).
      expect(body.month).toBe('2026-10');
      expect(body.income).toBe(81000);
      expect(body.bookings).toBe(4);
    });

    it('no cuenta las pendientes, las canceladas, las de otros meses ni las de otro propietario', async () => {
      const { body } = (await metrics('?month=2026-10').expect(200)) as { body: MetricsBody };
      const sala = body.spaces.find((s) => s.name === `Sala ${SUFFIX}`)!;

      expect(sala.bookings).toBe(3);
      expect(sala.income).toBe(72000);
    });

    it('la ocupación son las horas reservadas sobre las horas arrendables del horario semanal', async () => {
      const { body } = (await metrics('?month=2026-10').expect(200)) as { body: MetricsBody };
      const sala = body.spaces.find((s) => s.name === `Sala ${SUFFIX}`)!;

      // 3 h + 2 h + 1 h reservadas, sobre 4 lunes × 12 h + 5 sábados × 4 h = 68 h.
      expect(sala).toMatchObject({ bookedHours: 6, availableHours: 68, occupancy: 0.088 });
    });

    it('un espacio sin horario no tiene ocupación (null), pero sus ingresos cuentan', async () => {
      const { body } = (await metrics('?month=2026-10').expect(200)) as { body: MetricsBody };
      const taller = body.spaces.find((s) => s.name === `Taller ${SUFFIX}`)!;

      expect(taller).toMatchObject({ income: 9000, bookings: 1, bookedHours: 1, availableHours: 0, occupancy: null });
    });

    it('lista mis espacios por nombre, sin borradores ni los de otro propietario', async () => {
      const { body } = (await metrics('?month=2026-10').expect(200)) as { body: MetricsBody };

      expect(body.spaces.map((s) => s.name)).toEqual([`Sala ${SUFFIX}`, `Taller ${SUFFIX}`]);
    });

    it('el mes se mide en Chile: la reserva del 31 a las 23:00 es de octubre y la del 1 a las 00:30 es de noviembre', async () => {
      const october = (await metrics('?month=2026-10').expect(200)).body as MetricsBody;
      const november = (await metrics('?month=2026-11').expect(200)).body as MetricsBody;

      expect(october.spaces.find((s) => s.name === `Sala ${SUFFIX}`)).toMatchObject({ income: 72000 });
      expect(november).toMatchObject({ income: 12000, bookings: 1 });
    });

    it('otro mes trae sus propias reservas', async () => {
      const { body } = (await metrics('?month=2026-09').expect(200)) as { body: MetricsBody };

      expect(body).toMatchObject({ month: '2026-09', income: 12000, bookings: 1 });
    });

    it('un mes sin reservas da cero, no un error', async () => {
      const { body } = (await metrics('?month=2026-01').expect(200)) as { body: MetricsBody };

      expect(body.income).toBe(0);
      expect(body.bookings).toBe(0);
      expect(body.spaces[0]).toMatchObject({ income: 0, bookedHours: 0, occupancy: 0 });
    });

    it('sin mes usa el actual, en la hora de Chile', async () => {
      const { body } = (await metrics().expect(200)) as { body: MetricsBody };

      expect(body.month).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
    });

    it('nunca mezcla a otro propietario', async () => {
      const { body } = (await metrics('?month=2026-10', otherOwnerId).expect(200)) as { body: MetricsBody };

      expect(body).toMatchObject({ income: 99000, bookings: 1 });
      expect(body.spaces.map((s) => s.name)).toEqual([`Ajeno ${SUFFIX}`]);
    });

    it.each(['month=2026-13', 'month=2026-1', 'month=octubre', 'month=1999-10', 'mes=2026-10'])('rechaza %s con 400', async (query) => {
      await metrics(`?${query}`).expect(400);
    });
  });
});
