import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

const SUFFIX = `e2e-host-${Date.now()}`;

describe('POST /api/auth/host (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `ana-${SUFFIX}@host.test`,
        name: 'Ana',
        passwordHash: 'x',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${SUFFIX}@host.test` } },
    });
    await app.close();
  });

  const enableHost = () =>
    request(app.getHttpServer())
      .post('/api/auth/host')
      .set(bearer(app, userId));

  it('requires an authenticated user', async () => {
    await request(app.getHttpServer()).post('/api/auth/host').expect(401);
  });

  it('enables host mode and reports it in the public user profile', async () => {
    const response = await enableHost().expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      email: `ana-${SUFFIX}@host.test`,
      isHost: true,
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(
      (await prisma.user.findUnique({ where: { id: userId } }))?.isHost,
    ).toBe(true);
  });

  it('can be called repeatedly without changing the result', async () => {
    await enableHost().expect(200);
    await enableHost().expect(200);

    const profile = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(bearer(app, userId))
      .expect(200);
    expect(profile.body.isHost).toBe(true);
  });
});
