import { INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { uploadsDir } from '../src/storage/storage.service';
import { bearer } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
const SUFFIX = `e2e-pho-${Date.now()}`;

// Imágenes mínimas: lo que importa es la firma de los primeros bytes, que es como el back reconoce el formato.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24)]);

interface PhotoBody {
  id: string;
  url: string;
  position: number;
}

describe('Fotos del espacio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let otherId: string;
  const spaceIds: string[] = [];

  const as = (userId: string) => bearer(app, userId);
  const server = () => app.getHttpServer();

  const newSpace = async (userId = ownerId) => {
    const space = await prisma.space.create({ data: { name: `Espacio ${SUFFIX}`, ownerId: userId } });
    spaceIds.push(space.id);
    return space.id;
  };
  const upload = (spaceId: string, data: Buffer, filename = 'foto.png', contentType = 'image/png', userId = ownerId) =>
    request(server()).post(`/api/spaces/${spaceId}/photos`).set(as(userId)).attach('file', data, { filename, contentType });
  const photosOf = async (spaceId: string) =>
    (await request(server()).get(`/api/spaces/${spaceId}`).set(as(ownerId)).expect(200)).body.photos as PhotoBody[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = (key: string) =>
      prisma.user.create({
        data: { email: `${key}-${SUFFIX}@rentsmart.test`, passwordHash: 'no-es-un-hash-real', name: key },
      });
    ownerId = (await user('owner')).id;
    otherId = (await user('other')).id;
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } }); // las fotos caen en cascada
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    for (const id of spaceIds) await rm(join(uploadsDir(), 'spaces', id), { recursive: true, force: true });
    await app.close();
  });

  describe('POST /api/spaces/:id/photos', () => {
    it('sube una foto, queda al final y se puede ver en su dirección pública', async () => {
      const spaceId = await newSpace();

      const first = await upload(spaceId, PNG).expect(201);
      const second = await upload(spaceId, JPEG, 'b.jpg', 'image/jpeg').expect(201);
      const third = await upload(spaceId, WEBP, 'c.webp', 'image/webp').expect(201);

      expect(first.body).toEqual({ id: expect.any(String), url: expect.stringMatching(/^\/api\/uploads\/spaces\/.+\.png$/), position: 0 });
      expect((second.body as PhotoBody).position).toBe(1);
      expect((second.body as PhotoBody).url).toMatch(/\.jpg$/);
      expect((third.body as PhotoBody).url).toMatch(/\.webp$/);

      const served = await request(server()).get((first.body as PhotoBody).url).expect(200);
      expect(served.headers['content-type']).toBe('image/png');
      expect(Buffer.from(served.body as Buffer).equals(PNG)).toBe(true);
    });

    it('guarda el archivo con un nombre propio, sin usar el que manda el navegador', async () => {
      const spaceId = await newSpace();

      const { body } = await upload(spaceId, PNG, '../../etc/passwd.png').expect(201);

      expect((body as PhotoBody).url).not.toContain('passwd');
      expect((body as PhotoBody).url).toContain(`/spaces/${spaceId}/`);
    });

    it('reconoce el formato por el contenido, no por lo que declara el navegador', async () => {
      const spaceId = await newSpace();

      await upload(spaceId, Buffer.from('<html><script>alert(1)</script></html>'), 'foto.png', 'image/png').expect(400);
      await upload(spaceId, Buffer.from('GIF89a......'), 'foto.gif', 'image/gif').expect(400);
      // Una imagen válida con un tipo declarado raro se acepta igual.
      await upload(spaceId, PNG, 'foto.bin', 'application/octet-stream').expect(201);
    });

    it('responde 400 si no viene el archivo', async () => {
      const spaceId = await newSpace();

      const { body } = await request(server()).post(`/api/spaces/${spaceId}/photos`).set(as(ownerId)).expect(400);

      expect((body as { message: string }).message).toBe('Falta la foto');
    });

    it('responde 413 si la foto pesa más de 5 MB y no guarda nada', async () => {
      const spaceId = await newSpace();
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);

      await upload(spaceId, big).expect(413);

      expect(await photosOf(spaceId)).toEqual([]);
    });

    it('acepta una foto de justo 5 MB', async () => {
      const spaceId = await newSpace();
      const exact = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 - PNG.length)]);

      await upload(spaceId, exact).expect(201);
    });

    it('con 10 fotos responde 409 a la siguiente y no deja el archivo', async () => {
      const spaceId = await newSpace();
      for (let i = 0; i < 10; i++) await upload(spaceId, PNG).expect(201);

      const { body } = await upload(spaceId, PNG).expect(409);

      expect((body as { message: string }).message).toBe('Un espacio puede tener hasta 10 fotos');
      expect(await photosOf(spaceId)).toHaveLength(10);
      expect(await prisma.spacePhoto.count({ where: { spaceId } })).toBe(10);
    });

    it('con subidas a la vez nunca pasa de 10 ni repite posiciones', async () => {
      const spaceId = await newSpace();

      const results = await Promise.all(Array.from({ length: 13 }, () => upload(spaceId, PNG)));

      expect(results.filter((r) => r.status === 201)).toHaveLength(10);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);
      const positions = (await photosOf(spaceId)).map((p) => p.position);
      expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('responde 403 si el espacio es de otro y no sube nada', async () => {
      const spaceId = await newSpace();

      await upload(spaceId, PNG, 'foto.png', 'image/png', otherId).expect(403);

      expect(await prisma.spacePhoto.count({ where: { spaceId } })).toBe(0);
    });

    it('responde 404 si el espacio no existe y 401 con un usuario inválido', async () => {
      await upload('no-existe', PNG).expect(404);
      const spaceId = await newSpace();
      await upload(spaceId, PNG, 'foto.png', 'image/png', 'no-existe').expect(401);
    });
  });

  describe('GET /api/spaces/:id', () => {
    it('trae las fotos ordenadas por posición', async () => {
      const spaceId = await newSpace();
      const a = (await upload(spaceId, PNG).expect(201)).body as PhotoBody;
      const b = (await upload(spaceId, PNG).expect(201)).body as PhotoBody;

      expect((await photosOf(spaceId)).map((p) => p.id)).toEqual([a.id, b.id]);
    });
  });

  describe('PATCH /api/spaces/:id/photos/order', () => {
    const reorder = (spaceId: string, photoIds: unknown, userId = ownerId) =>
      request(server()).patch(`/api/spaces/${spaceId}/photos/order`).set(as(userId)).send({ photoIds });

    it('cambia el orden y la primera pasa a ser la portada', async () => {
      const spaceId = await newSpace();
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) ids.push(((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id);

      const { body } = await reorder(spaceId, [ids[2], ids[0], ids[1]]).expect(200);

      expect((body as PhotoBody[]).map((p) => [p.id, p.position])).toEqual([
        [ids[2], 0],
        [ids[0], 1],
        [ids[1], 2],
      ]);
      expect((await photosOf(spaceId)).map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
    });

    it('rechaza una lista que no sea exactamente las fotos del espacio', async () => {
      const spaceId = await newSpace();
      const otherSpaceId = await newSpace();
      const mine = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;
      const mine2 = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;
      const foreign = ((await upload(otherSpaceId, PNG).expect(201)).body as PhotoBody).id;

      await reorder(spaceId, [mine]).expect(400);
      await reorder(spaceId, [mine, mine, mine2]).expect(400);
      await reorder(spaceId, [mine, foreign]).expect(400);
      await reorder(spaceId, 'no-es-una-lista').expect(400);
      await reorder(spaceId, [1, 2]).expect(400);
      expect((await photosOf(spaceId)).map((p) => p.id)).toEqual([mine, mine2]);
    });

    it('responde 403 a otro usuario y 404 si el espacio no existe', async () => {
      const spaceId = await newSpace();
      const photo = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;

      await reorder(spaceId, [photo], otherId).expect(403);
      await reorder('no-existe', [photo]).expect(404);
    });
  });

  describe('DELETE /api/spaces/:id/photos/:photoId', () => {
    const remove = (spaceId: string, photoId: string, userId = ownerId) =>
      request(server()).delete(`/api/spaces/${spaceId}/photos/${photoId}`).set(as(userId));

    it('borra la foto y su archivo, y las demás suben de posición', async () => {
      const spaceId = await newSpace();
      const photos: PhotoBody[] = [];
      for (let i = 0; i < 3; i++) photos.push((await upload(spaceId, PNG).expect(201)).body as PhotoBody);
      const file = join(uploadsDir(), photos[1].url.replace('/api/uploads/', ''));
      expect(existsSync(file)).toBe(true);

      await remove(spaceId, photos[1].id).expect(204);

      expect(existsSync(file)).toBe(false);
      expect((await photosOf(spaceId)).map((p) => [p.id, p.position])).toEqual([
        [photos[0].id, 0],
        [photos[2].id, 1],
      ]);
      await request(server()).get(photos[1].url).expect(404);
    });

    it('al borrar la portada, la siguiente pasa a serlo', async () => {
      const spaceId = await newSpace();
      const first = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;
      const second = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;

      await remove(spaceId, first).expect(204);

      expect(await photosOf(spaceId)).toEqual([expect.objectContaining({ id: second, position: 0 })]);
    });

    it('después de borrar, se puede subir otra aunque hubiera 10', async () => {
      const spaceId = await newSpace();
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) ids.push(((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id);

      await remove(spaceId, ids[4]).expect(204);
      const { body } = await upload(spaceId, PNG).expect(201);

      expect((body as PhotoBody).position).toBe(9);
    });

    it('responde 404 si la foto no existe o es de otro espacio', async () => {
      const spaceId = await newSpace();
      const otherSpaceId = await newSpace();
      const foreign = ((await upload(otherSpaceId, PNG).expect(201)).body as PhotoBody).id;

      await remove(spaceId, 'no-existe').expect(404);
      await remove(spaceId, foreign).expect(404);
      expect(await prisma.spacePhoto.count({ where: { spaceId: otherSpaceId } })).toBe(1);
    });

    it('responde 403 a otro usuario y no borra nada', async () => {
      const spaceId = await newSpace();
      const photo = ((await upload(spaceId, PNG).expect(201)).body as PhotoBody).id;

      await remove(spaceId, photo, otherId).expect(403);

      expect(await photosOf(spaceId)).toHaveLength(1);
    });
  });
});
