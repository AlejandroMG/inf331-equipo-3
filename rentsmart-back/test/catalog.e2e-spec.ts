import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-cat-${Date.now()}`;
const SECRET = `Oficina secreta ${SUFFIX}`;

interface CatalogBody {
  items: Array<Record<string, unknown> & { id: string }>;
  total: number;
  page: number;
  pageSize: number;
}

describe('Catálogo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let typeId: number;
  let regionId: number;
  let communeId: number;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const owner = await prisma.user.create({
      data: {
        email: `owner-${SUFFIX}@rentsmart.test`,
        passwordHash: 'no-es-un-hash-real',
        name: 'Propietario e2e',
        isHost: true,
      },
    });
    ownerId = owner.id;
    typeId = (await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: { name: `Región ${SUFFIX}`, communes: { create: { name: `Comuna ${SUFFIX}` } } },
      include: { communes: true },
    });
    regionId = region.id;
    communeId = region.communes[0].id;
    const amenities = await Promise.all(
      ['Wifi', 'Proyector', 'Aire'].map((name) =>
        prisma.amenity.create({ data: { name: `${name} ${SUFFIX}` } }),
      ),
    );

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
      rules: 'No fumar',
    };
    // Fechas lejanas para que estos espacios queden primero y en un orden conocido. Los que no están
    // activos tienen fechas aún más nuevas: si el filtro fallara, aparecerían arriba de todo.
    const create = (key: string, data: Record<string, unknown>) =>
      prisma.space
        .create({ data: { ...base, name: `${key} ${SUFFIX}`, ...data } as never })
        .then((space) => {
          ids[key] = space.id;
        });

    await create('Activo-1', { status: 'ACTIVE', createdAt: new Date('2098-01-01'), pricePerDay: 90000 });
    await create('Activo-2', { status: 'ACTIVE', createdAt: new Date('2097-01-01'), pricePerDay: null });
    await create('Activo-3', { status: 'ACTIVE', createdAt: new Date('2096-01-01'), pricePerHour: null, pricePerDay: 80000 });
    await create('Borrador', { status: 'DRAFT', createdAt: new Date('2099-01-01') });
    await create('Inactivo', { status: 'INACTIVE', createdAt: new Date('2099-02-01') });
    await create('Bloqueado', { status: 'BLOCKED', createdAt: new Date('2099-03-01') });

    // Detalle completo en el espacio más nuevo: fotos desordenadas, equipamiento y horario.
    await prisma.spacePhoto.createMany({
      data: [
        { spaceId: ids['Activo-1'], storagePath: 'b.jpg', url: 'https://fotos.test/b.jpg', position: 1 },
        { spaceId: ids['Activo-1'], storagePath: 'a.jpg', url: 'https://fotos.test/a.jpg', position: 0 },
      ],
    });
    await prisma.spaceAmenity.createMany({
      data: amenities.map((a) => ({ spaceId: ids['Activo-1'], amenityId: a.id })),
    });
    await prisma.availabilityRule.createMany({
      data: [
        { spaceId: ids['Activo-1'], weekday: 3, startTime: '09:00', endTime: '21:00' },
        { spaceId: ids['Activo-1'], weekday: 1, startTime: '09:00', endTime: '21:00' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId } }); // fotos, equipamiento y horario caen en cascada
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.amenity.deleteMany({ where: { name: { endsWith: SUFFIX } } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.delete({ where: { id: typeId } });
    await app.close();
  });

  describe('GET /api/catalog', () => {
    it('lista solo los espacios activos, los más recientes primero, sin pedir sesión', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/catalog').expect(200);
      const page = body as CatalogBody;

      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(12);
      expect(page.total).toBeGreaterThanOrEqual(3);
      expect(page.items.slice(0, 3).map((i) => i.id)).toEqual([ids['Activo-1'], ids['Activo-2'], ids['Activo-3']]);
      const listed = page.items.map((i) => i.id);
      for (const key of ['Borrador', 'Inactivo', 'Bloqueado']) {
        expect(listed).not.toContain(ids[key]);
      }
    });

    it('cada espacio trae solo los campos del contrato, con la portada por posición', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/catalog').expect(200);
      const [first, second] = (body as CatalogBody).items;

      expect(first).toEqual({
        id: ids['Activo-1'],
        name: `Activo-1 ${SUFFIX}`,
        typeName: `Tipo ${SUFFIX}`,
        communeName: `Comuna ${SUFFIX}`,
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: 90000,
        coverUrl: 'https://fotos.test/a.jpg',
      });
      expect(second).toMatchObject({ pricePerHour: 12000, pricePerDay: null, coverUrl: null });
    });

    it('nunca expone el detalle privado de la dirección ni datos internos', async () => {
      const { text } = await request(app.getHttpServer()).get('/api/catalog?pageSize=50').expect(200);

      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('addressDetail');
      expect(text).not.toContain('ownerId');
    });

    it('pagina con page y pageSize', async () => {
      // Se filtra por la comuna de esta suite: otras suites e2e corren en paralelo sobre la misma BD
      // y crean espacios activos que cambiarían el total entre una petición y otra.
      const first = await request(app.getHttpServer())
        .get(`/api/catalog?pageSize=1&page=1&communeId=${communeId}`)
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`/api/catalog?pageSize=1&page=2&communeId=${communeId}`)
        .expect(200);

      expect((first.body as CatalogBody).items.map((i) => i.id)).toEqual([ids['Activo-1']]);
      expect((second.body as CatalogBody).items.map((i) => i.id)).toEqual([ids['Activo-2']]);
      expect((second.body as CatalogBody).page).toBe(2);
      expect((second.body as CatalogBody).pageSize).toBe(1);
      expect((second.body as CatalogBody).total).toBe((first.body as CatalogBody).total);
    });

    it('una página más allá del final devuelve la lista vacía y el total', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/catalog?page=9999').expect(200);

      expect((body as CatalogBody).items).toEqual([]);
      expect((body as CatalogBody).total).toBeGreaterThanOrEqual(3);
    });

    it.each(['page=0', 'page=-1', 'page=abc', 'page=1.5', 'pageSize=0', 'pageSize=51', 'pageSize=abc', 'foo=1'])(
      'responde 400 con %s',
      (query) => request(app.getHttpServer()).get(`/api/catalog?${query}`).expect(400),
    );
  });

  describe('GET /api/catalog/:id', () => {
    it('devuelve el detalle público completo', async () => {
      const { body } = await request(app.getHttpServer()).get(`/api/catalog/${ids['Activo-1']}`).expect(200);

      expect(body).toEqual({
        id: ids['Activo-1'],
        name: `Activo-1 ${SUFFIX}`,
        description: 'Sala luminosa',
        typeName: `Tipo ${SUFFIX}`,
        regionName: `Región ${SUFFIX}`,
        communeName: `Comuna ${SUFFIX}`,
        address: 'Av. Pública 123',
        location: null,
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: 90000,
        rules: 'No fumar',
        amenities: [`Aire ${SUFFIX}`, `Proyector ${SUFFIX}`, `Wifi ${SUFFIX}`],
        photos: [
          { id: expect.any(String), url: 'https://fotos.test/a.jpg', position: 0 },
          { id: expect.any(String), url: 'https://fotos.test/b.jpg', position: 1 },
        ],
        schedule: [
          { weekday: 1, startTime: '09:00', endTime: '21:00' },
          { weekday: 3, startTime: '09:00', endTime: '21:00' },
        ],
      });
    });

    it('nunca expone el detalle privado de la dirección ni datos internos', async () => {
      const { text } = await request(app.getHttpServer()).get(`/api/catalog/${ids['Activo-1']}`).expect(200);

      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('addressDetail');
      expect(text).not.toContain('ownerId');
    });

    it('un espacio sin fotos, equipamiento ni horario devuelve listas vacías', async () => {
      const { body } = await request(app.getHttpServer()).get(`/api/catalog/${ids['Activo-2']}`).expect(200);

      expect(body).toMatchObject({ amenities: [], photos: [], schedule: [] });
    });

    it.each(['Borrador', 'Inactivo', 'Bloqueado'])('responde 404 si el espacio está %s', async (key) => {
      const { body } = await request(app.getHttpServer()).get(`/api/catalog/${ids[key]}`).expect(404);

      expect((body as { message: string }).message).toBe('El espacio no existe');
    });

    it('responde 404 si el espacio no existe', () => {
      return request(app.getHttpServer()).get('/api/catalog/no-existe').expect(404);
    });
  });
});
