import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  const prisma = {
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
    space: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CatalogService);
  });

  describe('findPage', () => {
    const row = {
      id: 'abc',
      name: 'Sala Alameda',
      capacity: 10,
      pricePerHour: 12000,
      pricePerDay: null,
      type: { name: 'Sala de reuniones' },
      commune: { name: 'Santiago' },
      photos: [{ url: 'https://fotos.test/1.jpg' }],
    };

    it('pide solo los espacios activos, más recientes primero, y calcula el salto de la página', async () => {
      prisma.space.findMany.mockResolvedValue([row]);
      prisma.space.count.mockResolvedValue(25);

      await service.findPage({ page: 3, pageSize: 10 });

      expect(prisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.space.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });

    it('arma la página con el total y deja la portada en coverUrl', async () => {
      prisma.space.findMany.mockResolvedValue([row]);
      prisma.space.count.mockResolvedValue(25);

      await expect(service.findPage({ page: 1, pageSize: 12 })).resolves.toEqual(
        {
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
        },
      );
    });

    it('sin fotos la portada es null', async () => {
      prisma.space.findMany.mockResolvedValue([{ ...row, photos: [] }]);
      prisma.space.count.mockResolvedValue(1);

      const { items } = await service.findPage({ page: 1, pageSize: 12 });

      expect(items[0].coverUrl).toBeNull();
    });

    it('no pide campos privados', async () => {
      prisma.space.findMany.mockResolvedValue([]);
      prisma.space.count.mockResolvedValue(0);

      await service.findPage({ page: 1, pageSize: 12 });

      const { select } = prisma.space.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(select).not.toHaveProperty('addressDetail');
      expect(select).not.toHaveProperty('ownerId');
      expect(select).not.toHaveProperty('status');
    });
  });

  describe('findOne', () => {
    const space = {
      id: 'abc',
      name: 'Sala Alameda',
      description: 'Luminosa',
      address: 'Av. Libertador 1234',
      capacity: 10,
      pricePerHour: 12000,
      pricePerDay: null,
      rules: null,
      type: { name: 'Sala de reuniones' },
      commune: { name: 'Santiago', region: { name: 'Región Metropolitana' } },
      amenities: [
        { amenity: { name: 'Wifi' } },
        { amenity: { name: 'Aire acondicionado' } },
        { amenity: { name: 'Proyector' } },
      ],
      photos: [{ id: 'p1', url: 'https://fotos.test/1.jpg', position: 0 }],
      rulesWeek: [{ weekday: 1, startTime: '09:00', endTime: '21:00' }],
    };

    it('busca solo entre los espacios activos', async () => {
      prisma.space.findFirst.mockResolvedValue(space);

      await service.findOne('abc');

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'abc', status: 'ACTIVE' } }),
      );
    });

    it('arma el detalle con el equipamiento ordenado por nombre', async () => {
      prisma.space.findFirst.mockResolvedValue(space);

      await expect(service.findOne('abc')).resolves.toEqual({
        id: 'abc',
        name: 'Sala Alameda',
        description: 'Luminosa',
        typeName: 'Sala de reuniones',
        regionName: 'Región Metropolitana',
        communeName: 'Santiago',
        address: 'Av. Libertador 1234',
        capacity: 10,
        pricePerHour: 12000,
        pricePerDay: null,
        rules: null,
        amenities: ['Aire acondicionado', 'Proyector', 'Wifi'],
        photos: [{ id: 'p1', url: 'https://fotos.test/1.jpg', position: 0 }],
        schedule: [{ weekday: 1, startTime: '09:00', endTime: '21:00' }],
      });
    });

    it('no pide el detalle privado de la dirección', async () => {
      prisma.space.findFirst.mockResolvedValue(space);

      await service.findOne('abc');

      const { select } = prisma.space.findFirst.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(select).not.toHaveProperty('addressDetail');
      expect(select).not.toHaveProperty('ownerId');
      expect(select).not.toHaveProperty('status');
    });

    it('lanza 404 si no existe o no está activo', async () => {
      prisma.space.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
