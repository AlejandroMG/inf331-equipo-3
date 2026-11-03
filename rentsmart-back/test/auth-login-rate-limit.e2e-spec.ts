import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('Límite de intentos en POST /api/auth/login (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza el intento 11 dentro de 15 minutos con 429', async () => {
    const login = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-existe@rentsmart.test', password: 'Password123' });

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await login().expect(401);
    }

    const limited = await login().expect(429);

    expect(limited.body.statusCode).toBe(429);
  });
});
