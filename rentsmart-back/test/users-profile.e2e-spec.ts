import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

const SUFFIX = `profile-${Date.now()}`;
const email = `profile-${SUFFIX}@test.local`;

describe('Perfiles de usuario (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: { email, name: 'Ana', passwordHash: 'x', isHost: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${SUFFIX}@test.local` } },
    });
    await app.close();
  });

  it('permite consultar y editar el perfil privado con sesión', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);

    const response = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set(bearer(app, userId))
      .send({ name: 'Ana Pérez', phone: '+56912345678', bio: 'Anfitriona' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      email,
      name: 'Ana Pérez',
      phone: '+56912345678',
      bio: 'Anfitriona',
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.profilePhotoPath).toBeUndefined();
  });

  it('valida el perfil y entrega una vista pública sin datos privados', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set(bearer(app, userId))
      .send({ name: '' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .get(`/api/users/${userId}/profile`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      name: 'Ana Pérez',
      reviewCount: 0,
      averageRating: null,
      reviews: [],
    });
    expect(response.body.email).toBeUndefined();
    expect(response.body.phone).toBeUndefined();
  });

  it('sube y quita una foto de perfil', async () => {
    const uploaded = await request(app.getHttpServer())
      .post('/api/users/me/photo')
      .set(bearer(app, userId))
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'profile.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(uploaded.body.profilePhotoUrl).toContain('/api/uploads/users/');
    expect(uploaded.body.profilePhotoPath).toBeUndefined();

    const removed = await request(app.getHttpServer())
      .delete('/api/users/me/photo')
      .set(bearer(app, userId))
      .expect(200);
    expect(removed.body.profilePhotoUrl).toBeNull();
  });

  it('no publica perfiles que no son de anfitriones', async () => {
    const renter = await prisma.user.create({
      data: {
        email: `renter-${SUFFIX}@test.local`,
        name: 'Renter',
        passwordHash: 'x',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/users/${renter.id}/profile`)
      .expect(404);
  });
});
