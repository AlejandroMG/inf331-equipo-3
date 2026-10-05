import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PhotosService } from './photos.service';
import { SpacesService } from './spaces.service';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(10),
]);
const file = (buffer: Buffer, size = buffer.length) =>
  ({ buffer, size }) as Express.Multer.File;

describe('PhotosService', () => {
  let service: PhotosService;
  const tx = {
    $queryRaw: jest.fn(),
    spacePhoto: { count: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    spacePhoto: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn((args: unknown) => args),
      delete: jest.fn((args: unknown) => args),
      updateMany: jest.fn((args: unknown) => args),
    },
  };
  const storage = { upload: jest.fn(), remove: jest.fn() };
  const spaces = { ensureOwner: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    );
    storage.upload.mockImplementation((path: string) => ({
      path,
      url: `/api/uploads/${path}`,
    }));
    storage.remove.mockResolvedValue(undefined);
    spaces.ensureOwner.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: SpacesService, useValue: spaces },
      ],
    }).compile();
    service = module.get(PhotosService);
  });

  describe('add', () => {
    it('comprueba primero que el espacio sea del usuario', async () => {
      spaces.ensureOwner.mockRejectedValue(new NotFoundException());

      await expect(service.add('u1', 's1', file(png))).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rechaza si no viene un archivo', async () => {
      await expect(service.add('u1', 's1', undefined)).rejects.toThrow(
        'Falta la foto',
      );
    });

    it('rechaza lo que pese más de 5 MB', async () => {
      await expect(
        service.add('u1', 's1', file(png, 5 * 1024 * 1024 + 1)),
      ).rejects.toThrow('5 MB');
    });

    it('rechaza lo que no sea JPG, PNG o WebP aunque se declare como imagen', async () => {
      await expect(
        service.add('u1', 's1', file(Buffer.from('<html></html>'))),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('guarda el archivo y la foto queda al final', async () => {
      tx.spacePhoto.count.mockResolvedValue(3);
      tx.spacePhoto.create.mockResolvedValue({ id: 'p4', url: 'u', position: 3 });

      const photo = await service.add('u1', 's1', file(png));

      const [path, , contentType] = storage.upload.mock.calls[0] as [
        string,
        Buffer,
        string,
      ];
      expect(path).toMatch(/^spaces\/s1\/[0-9a-f-]{36}\.png$/);
      expect(contentType).toBe('image/png');
      expect(tx.spacePhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            spaceId: 's1',
            storagePath: path,
            position: 3,
          }) as unknown,
        }),
      );
      expect(photo).toEqual({ id: 'p4', url: 'u', position: 3 });
    });

    it('con 10 fotos responde 409 y borra el archivo que ya había subido', async () => {
      tx.spacePhoto.count.mockResolvedValue(10);

      await expect(service.add('u1', 's1', file(png))).rejects.toThrow(
        ConflictException,
      );

      const [path] = storage.upload.mock.calls[0] as [string];
      expect(storage.remove).toHaveBeenCalledWith(path);
      expect(tx.spacePhoto.create).not.toHaveBeenCalled();
    });

    it('si la base falla, borra el archivo', async () => {
      tx.spacePhoto.count.mockResolvedValue(0);
      tx.spacePhoto.create.mockRejectedValue(new Error('caída'));

      await expect(service.add('u1', 's1', file(png))).rejects.toThrow('caída');
      expect(storage.remove).toHaveBeenCalledTimes(1);
    });

    it('si además falla el borrado del archivo, devuelve el error original', async () => {
      tx.spacePhoto.count.mockResolvedValue(10);
      storage.remove.mockRejectedValue(new Error('disco'));

      await expect(service.add('u1', 's1', file(png))).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.spacePhoto.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
        .mockResolvedValueOnce([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    });

    it('asigna las posiciones según el orden recibido', async () => {
      const photos = await service.reorder('u1', 's1', ['c', 'a', 'b']);

      expect(prisma.spacePhoto.update.mock.calls.map((c) => c[0])).toEqual([
        { where: { id: 'c' }, data: { position: 0 } },
        { where: { id: 'a' }, data: { position: 1 } },
        { where: { id: 'b' }, data: { position: 2 } },
      ]);
      expect(photos.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    });

    it.each([
      ['falta una foto', ['a', 'b']],
      ['sobra una que no es del espacio', ['a', 'b', 'c', 'z']],
      ['trae otra distinta', ['a', 'b', 'z']],
      ['repite una', ['a', 'a', 'b']],
    ])('rechaza la lista si %s', async (_caso, ids) => {
      await expect(service.reorder('u1', 's1', ids)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.spacePhoto.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lanza 404 si la foto no es de ese espacio', async () => {
      prisma.spacePhoto.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 's1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.spacePhoto.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'x', spaceId: 's1' } }),
      );
    });

    it('borra la foto, sube las siguientes un lugar y borra el archivo', async () => {
      prisma.spacePhoto.findFirst.mockResolvedValue({
        id: 'p2',
        position: 1,
        storagePath: 'spaces/s1/b.png',
      });

      await service.remove('u1', 's1', 'p2');

      expect(prisma.spacePhoto.delete).toHaveBeenCalledWith({ where: { id: 'p2' } });
      expect(prisma.spacePhoto.updateMany).toHaveBeenCalledWith({
        where: { spaceId: 's1', position: { gt: 1 } },
        data: { position: { decrement: 1 } },
      });
      expect(storage.remove).toHaveBeenCalledWith('spaces/s1/b.png');
    });

    it('si no se puede borrar el archivo, igual termina bien', async () => {
      prisma.spacePhoto.findFirst.mockResolvedValue({
        id: 'p1',
        position: 0,
        storagePath: 'x.png',
      });
      storage.remove.mockRejectedValue(new Error('disco'));

      await expect(service.remove('u1', 's1', 'p1')).resolves.toBeUndefined();
    });
  });
});
