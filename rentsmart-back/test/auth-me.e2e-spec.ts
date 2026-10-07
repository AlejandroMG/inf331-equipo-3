import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada ejecución usa emails con un sufijo único, así no choca con el seed ni con otras corridas.
const SUFFIX = `e2e-${Date.now()}`;
const email = (name: string) => `${name}-${SUFFIX}@me.test`;

describe('GET /api/auth/me y JwtAuthGuard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: { email: email('ana'), name: 'Ana', passwordHash: 'x' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${SUFFIX}@me.test` } },
    });
    await app.close();
  });

  const me = () => request(app.getHttpServer()).get('/api/auth/me');

  it('devuelve el usuario de la sesión sin datos sensibles (200)', async () => {
    const res = await me().set(bearer(app, userId)).expect(200);

    expect(res.body).toMatchObject({
      id: userId,
      email: email('ana'),
      name: 'Ana',
      role: 'USER',
      isHost: false,
    });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.status).toBeUndefined();
  });

  it('el token del login sirve para /me (flujo completo)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: email('flujo'), password: 'Password123', name: 'Flujo' })
      .expect(201);
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: email('flujo'), password: 'Password123' })
      .expect(200);

    const res = await me()
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(email('flujo'));
  });

  it('responde 401 sin token', async () => {
    const res = await me().expect(401);

    expect(res.body.message).toBe('Inicia sesión para continuar.');
  });

  it('responde 401 con un token inválido o expirado', async () => {
    await me().set('Authorization', 'Bearer no-es-un-jwt').expect(401);

    const expired = app
      .get(JwtService)
      .sign({ sub: userId, role: 'USER' }, { expiresIn: -10 });
    await me().set('Authorization', `Bearer ${expired}`).expect(401);
  });

  it('responde 401 si la cuenta se suspende después de iniciar sesión', async () => {
    const suspended = await prisma.user.create({
      data: {
        email: email('suspendida'),
        name: 'S',
        passwordHash: 'x',
      },
    });
    const header = bearer(app, suspended.id);
    await me().set(header).expect(200);

    await prisma.user.update({
      where: { id: suspended.id },
      data: { status: 'SUSPENDED' },
    });

    await me().set(header).expect(401);
  });

  it('los endpoints de espacios exigen sesión: sin token, 401', async () => {
    await request(app.getHttpServer()).get('/api/spaces/me').expect(401);
  });
});
