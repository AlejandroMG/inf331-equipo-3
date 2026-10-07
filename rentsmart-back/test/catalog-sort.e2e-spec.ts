import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
// Un tipo propio acota cada consulta a estos espacios.
const SUFFIX = `e2e-ord-${Date.now()}`;

interface CatalogBody {
  items: Array<{ id: string; name: string }>;
  total: number;
}

describe('Orden del catálogo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;

  const server = () => app.getHttpServer();
  const get = async (query: string) =>
    (await request(server()).get(`/api/catalog?typeId=${typeId}&${query}`).expect(200)).body as CatalogBody;
  /** Los nombres (sin el sufijo) en el orden en que salen. */
  const order = async (query: string) =>
    (await get(`pageSize=50&${query}`)).items.map((item) => item.name.replace(` ${SUFFIX}`, ''));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    ownerId = (
      await prisma.user.create({
        data: {
          email: `owner-${SUFFIX}@rentsmart.test`,
          passwordHash: 'no-es-un-hash-real',
          name: 'Propietario e2e',
          isHost: true,
        },
      })
    ).id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;

    const create = (key: string, data: Record<string, unknown>) =>
      prisma.space.create({
        data: {
          ownerId,
          typeId,
          regionId,
          communeId,
          status: 'ACTIVE',
          name: `${key} ${SUFFIX}`,
          description: 'x',
          capacity: 4,
          address: 'Av. Pública 123',
          ...data,
        } as never,
      });

    // Del más nuevo al más viejo: A, B, C, D, E. A y C tienen el mismo precio por hora; D no se arrienda por hora
    // y A no se arrienda por día.
    await create('A', { pricePerHour: 10000, pricePerDay: null, createdAt: new Date('2001-05-01') });
    await create('B', { pricePerHour: 20000, pricePerDay: 90000, createdAt: new Date('2001-04-01') });
    await create('C', { pricePerHour: 10000, pricePerDay: 60000, createdAt: new Date('2001-03-01') });
    await create('D', { pricePerHour: null, pricePerDay: 50000, createdAt: new Date('2001-02-01') });
    await create('E', { pricePerHour: 15000, pricePerDay: 30000, createdAt: new Date('2001-01-01') });
    // No está activo: nunca aparece, se ordene como se ordene.
    await create('Borrador', { status: 'DRAFT', pricePerHour: 1, createdAt: new Date('2002-01-01') });
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  it('por defecto salen los más recientes primero', async () => {
    expect(await order('')).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(await order('sort=recent')).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  describe('por precio por hora', () => {
    it('de menor a mayor: los precios iguales se desempatan por fecha y los que no tienen van al final', async () => {
      expect(await order('sort=price_asc')).toEqual(['A', 'C', 'E', 'B', 'D']);
    });

    it('de mayor a menor: los que no tienen precio por hora siguen al final', async () => {
      expect(await order('sort=price_desc')).toEqual(['B', 'E', 'A', 'C', 'D']);
    });

    it('priceUnit=hour es lo mismo que no indicarla', async () => {
      expect(await order('sort=price_asc&priceUnit=hour')).toEqual(['A', 'C', 'E', 'B', 'D']);
    });
  });

  describe('por precio por día', () => {
    it('de menor a mayor, con los que no se arriendan por día al final', async () => {
      expect(await order('sort=price_asc&priceUnit=day')).toEqual(['E', 'D', 'C', 'B', 'A']);
    });

    it('de mayor a menor, con los que no se arriendan por día al final', async () => {
      expect(await order('sort=price_desc&priceUnit=day')).toEqual(['B', 'C', 'D', 'E', 'A']);
    });
  });

  it('la unidad sola, sin ordenar por precio, no cambia el orden por fecha', async () => {
    expect(await order('priceUnit=day')).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('se combina con los filtros y respeta el rango de precio', async () => {
    expect(await order('sort=price_desc&minPrice=10000&maxPrice=15000')).toEqual(['E', 'A', 'C']);
    expect(await order('sort=price_asc&priceUnit=day&minPrice=40000')).toEqual(['D', 'C', 'B']);
  });

  it('el orden no cambia el total', async () => {
    const recent = await get('pageSize=2');
    const cheapest = await get('pageSize=2&sort=price_asc');

    expect(recent.total).toBe(5);
    expect(cheapest.total).toBe(5);
  });

  it('pagina sin repetir ni saltarse espacios, aunque haya precios iguales', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => get(`pageSize=2&page=${page}&sort=price_asc`)));
    const names = pages.map((page) => page.items.map((item) => item.name.replace(` ${SUFFIX}`, '')));

    expect(names).toEqual([['A', 'C'], ['E', 'B'], ['D']]);
  });

  it.each(['sort=cheap', 'sort=', 'sort=PRICE_ASC', 'sort=price_asc&sort=price_desc'])(
    'responde 400 con %s',
    (query) => request(server()).get(`/api/catalog?${query}`).expect(400),
  );
});
