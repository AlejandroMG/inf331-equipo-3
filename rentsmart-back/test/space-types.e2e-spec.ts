import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-${Date.now()}`;

describe('Datos de referencia (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let regionId: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.spaceType.create({ data: { name: `Tipo ${SUFFIX}` } });
    await prisma.amenity.create({ data: { name: `Equipo ${SUFFIX}` } });
    // Las comunas se crean en desorden para comprobar que la API las ordena por nombre.
    const region = await prisma.region.create({
      data: {
        name: `Región ${SUFFIX}`,
        communes: {
          create: [{ name: `B ${SUFFIX}` }, { name: `A ${SUFFIX}` }],
        },
      },
    });
    regionId = region.id;
  });

  afterAll(async () => {
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.amenity.delete({ where: { name: `Equipo ${SUFFIX}` } });
    await prisma.spaceType.delete({ where: { name: `Tipo ${SUFFIX}` } });
    await app.close();
  });

  it('GET /api/space-types lista los tipos sin pedir sesión', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/space-types')
      .expect(200);

    expect(body).toEqual(
      expect.arrayContaining([
        { id: expect.any(Number), name: `Tipo ${SUFFIX}` },
      ]),
    );
    for (const item of body as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual(['id', 'name']);
    }
  });

  it('GET /api/amenities lista el equipamiento', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/amenities')
      .expect(200);

    expect(body).toEqual(
      expect.arrayContaining([
        { id: expect.any(Number), name: `Equipo ${SUFFIX}` },
      ]),
    );
  });

  it('GET /api/regions lista las regiones', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/regions')
      .expect(200);

    expect(body).toEqual(
      expect.arrayContaining([{ id: regionId, name: `Región ${SUFFIX}` }]),
    );
  });

  it('GET /api/regions/:id/communes lista las comunas ordenadas por nombre', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/regions/${regionId}/communes`)
      .expect(200);

    expect((body as Array<{ name: string }>).map((c) => c.name)).toEqual([
      `A ${SUFFIX}`,
      `B ${SUFFIX}`,
    ]);
  });

  it('GET /api/regions/:id/communes responde 404 si la región no existe', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/regions/2147483647/communes')
      .expect(404);

    expect(body.message).toBe('La región no existe');
  });

  it('GET /api/regions/:id/communes responde 400 si el id no es un número', () => {
    return request(app.getHttpServer())
      .get('/api/regions/abc/communes')
      .expect(400);
  });
});
