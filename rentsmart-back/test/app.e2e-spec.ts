import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('API base (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde bajo el prefijo /api', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('no responde sin el prefijo /api', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('publica Swagger en /docs con los endpoints bajo /api', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);

    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(body.info.title).toBe('RentSmart API');
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/api/space-types',
        '/api/amenities',
        '/api/regions',
        '/api/regions/{id}/communes',
      ]),
    );
  });
});
