import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    review: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const storage = {
    upload: jest.fn(),
    remove: jest.fn(),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  it('actualiza solo los campos permitidos y limpia valores opcionales vacíos', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    await service.update('user-1', {
      name: 'Ana',
      phone: '',
      bio: '',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { name: 'Ana', phone: null, bio: null },
      }),
    );
  });

  it('rechaza subir una foto sin archivo o con formato no admitido', async () => {
    await expect(
      service.uploadPhoto('user-1', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadPhoto('user-1', {
        size: 3,
        buffer: Buffer.from('bad'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('reemplaza la foto y retira el archivo anterior sin exponer su ruta', async () => {
    prisma.user.findUnique.mockResolvedValue({
      profilePhotoPath: 'users/user-1/old.jpg',
    });
    storage.upload.mockResolvedValue({
      path: 'users/user-1/new.jpg',
      url: '/api/uploads/users/user-1/new.jpg',
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      profilePhotoPath: 'users/user-1/new.jpg',
      profilePhotoUrl: '/api/uploads/users/user-1/new.jpg',
    });
    storage.remove.mockResolvedValue(undefined);

    const result = await service.uploadPhoto('user-1', {
      size: 3,
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    } as Express.Multer.File);

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/user-1\/.+\.jpg$/),
      expect.any(Buffer),
      'image/jpeg',
    );
    expect(storage.remove).toHaveBeenCalledWith('users/user-1/old.jpg');
    expect(result).not.toHaveProperty('profilePhotoPath');
  });

  it('expone únicamente perfil público activo de anfitrión y sus reseñas agregadas', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'host-1',
      name: 'Ana',
      bio: null,
      profilePhotoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    prisma.review.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _avg: { rating: 4.5 },
    });
    prisma.review.findMany.mockResolvedValue([
      {
        id: 'review-1',
        rating: 5,
        comment: 'Muy bien',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        author: { name: 'Luis' },
        space: { name: 'Sala' },
      },
    ]);

    await expect(service.publicProfile('host-1')).resolves.toMatchObject({
      id: 'host-1',
      reviewCount: 2,
      averageRating: 4.5,
      reviews: [{ authorName: 'Luis', spaceName: 'Sala', rating: 5 }],
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'host-1', isHost: true, status: 'ACTIVE' },
      }),
    );
    expect(prisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { space: { ownerId: 'host-1' } } }),
    );
  });

  it('responde 404 para perfiles no públicos', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.publicProfile('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.review.aggregate).not.toHaveBeenCalled();
  });
});
