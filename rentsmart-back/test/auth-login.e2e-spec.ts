import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada ejecución usa emails con un sufijo único, así no choca con el seed ni con otras corridas.
const SUFFIX = `e2e-${Date.now()}`;
const email = (name: string) => `${name}-${SUFFIX}@login.test`;
const PASSWORD = 'Password123';

describe('POST /api/auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await prisma.user.createMany({
      data: [
        { email: email('activa'), name: 'Activa', passwordHash },
        {
          email: email('suspendida'),
          name: 'Suspendida',
          passwordHash,
          status: 'SUSPENDED',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${SUFFIX}@login.test` } },
    });
    await app.close();
  });

  const login = (body: object) =>
    request(app.getHttpServer()).post('/api/auth/login').send(body);

  it('devuelve un token con expiración y el usuario sin contraseña (200)', async () => {
    const res = await login({
      email: email('activa'),
      password: PASSWORD,
    }).expect(200);

    expect(res.body.user).toMatchObject({
      email: email('activa'),
      name: 'Activa',
      role: 'USER',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.status).toBeUndefined();

    const payload = app
      .get(JwtService)
      .verify<{ sub: string; role: string; exp: number; iat: number }>(
        res.body.accessToken,
      );
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.role).toBe('USER');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('acepta el email con mayúsculas y espacios', async () => {
    await login({
      email: `  ${email('activa').toUpperCase()} `,
      password: PASSWORD,
    }).expect(200);
  });

  it('rechaza una contraseña incorrecta con 401', async () => {
    const res = await login({
      email: email('activa'),
      password: 'otra-clave',
    }).expect(401);

    expect(res.body.message).toBe('Email o contraseña incorrectos.');
  });

  it('responde lo mismo si el email no existe', async () => {
    const res = await login({
      email: email('nadie'),
      password: PASSWORD,
    }).expect(401);

    expect(res.body.message).toBe('Email o contraseña incorrectos.');
  });

  it('bloquea una cuenta suspendida con 403', async () => {
    const res = await login({
      email: email('suspendida'),
      password: PASSWORD,
    }).expect(403);

    expect(res.body.message).toContain('suspendida');
  });

  it('rechaza datos incompletos con 400', async () => {
    await login({ email: email('activa') }).expect(400);
    await login({ email: 'no-es-email', password: PASSWORD }).expect(400);
  });
});
