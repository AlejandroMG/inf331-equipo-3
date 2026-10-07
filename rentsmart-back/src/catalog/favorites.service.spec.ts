import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService, MAX_FAVORITES } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  const prisma = {
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
    space: { findFirst: jest.fn() },
    favorite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );
    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  describe('list', () => {
    const space = {
      id: 'abc',
      name: 'Sala Alameda',
      capacity: 10,
      pricePerHour: 12000,
      pricePerDay: null,
      type: { name: 'Sala de reuniones' },
      commune: { name: 'Santiago' },
      photos: [{ url: 'https://fotos.test/1.jpg' }],
    };

    it('pide solo los favoritos del usuario cuyo espacio sigue activo, los más recientes primero', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);
      prisma.favorite.count.mockResolvedValue(0);

      await service.list('u1', { page: 3, pageSize: 10 });

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', space: { status: 'ACTIVE' } },
          orderBy: [{ createdAt: 'desc' }, { spaceId: 'asc' }],
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.favorite.count).toHaveBeenCalledWith({
        where: { userId: 'u1', space: { status: 'ACTIVE' } },
      });
    });

    it('devuelve las tarjetas del catálogo con el total y la paginación', async () => {
      prisma.favorite.findMany.mockResolvedValue([{ space }]);
      prisma.favorite.count.mockResolvedValue(25);

      await expect(
        service.list('u1', { page: 1, pageSize: 12 }),
      ).resolves.toEqual({
        items: [
          {
            id: 'abc',
            name: 'Sala Alameda',
            typeName: 'Sala de reuniones',
            communeName: 'Santiago',
            capacity: 10,
            pricePerHour: 12000,
            pricePerDay: null,
            coverUrl: 'https://fotos.test/1.jpg',
          },
        ],
        total: 25,
        page: 1,
        pageSize: 12,
      });
    });

    it('no pide campos privados del espacio', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);
      prisma.favorite.count.mockResolvedValue(0);

      await service.list('u1', { page: 1, pageSize: 12 });

      const { select } = prisma.favorite.findMany.mock.calls[0][0] as {
        select: { space: { select: Record<string, unknown> } };
      };
      for (const key of ['addressDetail', 'ownerId', 'status', 'latitude']) {
        expect(select.space.select).not.toHaveProperty(key);
      }
    });
  });

  describe('ids', () => {
    it('devuelve solo los ids, de los espacios activos', async () => {
      prisma.favorite.findMany.mockResolvedValue([
        { spaceId: 'b' },
        { spaceId: 'a' },
      ]);

      await expect(service.ids('u1')).resolves.toEqual(['b', 'a']);
      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', space: { status: 'ACTIVE' } },
          select: { spaceId: true },
        }),
      );
    });
  });

  describe('add', () => {
    it('guarda un espacio activo', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's1' });
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.count.mockResolvedValue(0);

      await service.add('u1', 's1');

      expect(prisma.space.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', status: 'ACTIVE' },
        select: { id: true },
      });
      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_spaceId: { userId: 'u1', spaceId: 's1' } },
        create: { userId: 'u1', spaceId: 's1' },
        update: {},
      });
    });

    it('lanza 404 si el espacio no existe o no está activo, y no guarda nada', async () => {
      prisma.space.findFirst.mockResolvedValue(null);

      await expect(service.add('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('guardar uno que ya es favorito no hace nada, ni siquiera con el tope lleno', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's1' });
      prisma.favorite.findUnique.mockResolvedValue({ spaceId: 's1' });
      prisma.favorite.count.mockResolvedValue(MAX_FAVORITES);

      await expect(service.add('u1', 's1')).resolves.toBeUndefined();
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('con el tope de favoritos lleno responde 409', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's1' });
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.count.mockResolvedValue(MAX_FAVORITES);

      await expect(service.add('u1', 's1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('con un favorito menos que el tope todavía deja guardar', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's1' });
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.count.mockResolvedValue(MAX_FAVORITES - 1);

      await service.add('u1', 's1');

      expect(prisma.favorite.upsert).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('quita solo el favorito de ese usuario', async () => {
      await service.remove('u1', 's1');

      expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', spaceId: 's1' },
      });
    });
  });
});
