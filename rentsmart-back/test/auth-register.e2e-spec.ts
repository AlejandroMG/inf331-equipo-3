import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada ejecución usa emails con un sufijo único, así no choca con el seed ni con otras corridas.
const SUFFIX = `e2e-${Date.now()}`;
const email = (name: string) => `${name}-${SUFFIX}@register.test`;

describe('POST /api/auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${SUFFIX}@register.test` } },
    });
    await app.close();
  });

  const register = (body: object) =>
    request(app.getHttpServer()).post('/api/auth/register').send(body);

  it('crea la cuenta (201) sin devolver la contraseña', async () => {
    const res = await register({
      email: email('ana'),
      password: 'Password123',
      name: 'Ana',
    }).expect(201);

    expect(res.body).toMatchObject({
      email: email('ana'),
      name: 'Ana',
      role: 'USER',
      isHost: false,
    });
    expect(res.body.passwordHash).toBeUndefined();

    const saved = await prisma.user.findUnique({
      where: { email: email('ana') },
    });
    expect(saved?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('guarda el email en minúsculas y sin espacios', async () => {
    const res = await register({
      email: `  ${email('Mixto').toUpperCase()}  `,
      password: 'Password123',
      name: 'Mixto',
    }).expect(201);

    expect(res.body.email).toBe(email('mixto'));
  });

  it('rechaza un email ya registrado con 409', async () => {
    const body = {
      email: email('repetido'),
      password: 'Password123',
      name: 'R',
    };
    await register(body).expect(201);

    const res = await register(body).expect(409);

    expect(res.body.message).toBe('Ya existe una cuenta con este email.');
  });

  it.each([
    [
      'email mal formado',
      { email: 'no-es-email', password: 'Password123', name: 'X' },
      'Ingresa un email válido.',
    ],
    [
      'contraseña de 7 caracteres',
      { email: email('corta'), password: '1234567', name: 'X' },
      'La contraseña debe tener al menos 8 caracteres.',
    ],
    [
      'nombre vacío',
      { email: email('sinnombre'), password: 'Password123', name: '   ' },
      'El nombre es obligatorio.',
    ],
  ])('rechaza %s con 400 y un mensaje claro', async (_caso, body, message) => {
    const res = await register(body).expect(400);

    expect(res.body.message).toContain(message);
  });

  it('acepta una contraseña de exactamente 8 caracteres', async () => {
    await register({
      email: email('limite'),
      password: '12345678',
      name: 'Límite',
    }).expect(201);
  });

  it('rechaza campos extra: nadie se registra como ADMIN', async () => {
    await register({
      email: email('admin'),
      password: 'Password123',
      name: 'X',
      role: 'ADMIN',
    }).expect(400);
  });

  it('permite que el front (otro origen) llame a la API: CORS', async () => {
    const origin = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    const res = await request(app.getHttpServer())
      .options('/api/auth/register')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });
});
