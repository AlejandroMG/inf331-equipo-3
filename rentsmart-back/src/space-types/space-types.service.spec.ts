import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SpaceTypesService } from './space-types.service';

describe('SpaceTypesService', () => {
  let service: SpaceTypesService;
  const prisma = {
    spaceType: { findMany: jest.fn() },
    amenity: { findMany: jest.fn() },
    region: { findMany: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SpaceTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SpaceTypesService);
  });

  it('lista los tipos de espacio en el orden en que se cargaron', async () => {
    const types = [{ id: 1, name: 'Sala de reuniones' }];
    prisma.spaceType.findMany.mockResolvedValue(types);

    await expect(service.findSpaceTypes()).resolves.toEqual(types);

    expect(prisma.spaceType.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  });

  it('lista el equipamiento ordenado por nombre', async () => {
    const amenities = [{ id: 2, name: 'Proyector' }];
    prisma.amenity.findMany.mockResolvedValue(amenities);

    await expect(service.findAmenities()).resolves.toEqual(amenities);

    expect(prisma.amenity.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  it('lista las regiones ordenadas por nombre', async () => {
    const regions = [{ id: 1, name: 'Región Metropolitana' }];
    prisma.region.findMany.mockResolvedValue(regions);

    await expect(service.findRegions()).resolves.toEqual(regions);

    expect(prisma.region.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  describe('findCommunes', () => {
    it('devuelve las comunas de la región ordenadas por nombre', async () => {
      const communes = [{ id: 3, name: 'Providencia' }];
      prisma.region.findUnique.mockResolvedValue({ communes });

      await expect(service.findCommunes(1)).resolves.toEqual(communes);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          communes: {
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
      });
    });

    it('devuelve una lista vacía si la región existe y no tiene comunas', async () => {
      prisma.region.findUnique.mockResolvedValue({ communes: [] });

      await expect(service.findCommunes(1)).resolves.toEqual([]);
    });

    it('lanza 404 si la región no existe', async () => {
      prisma.region.findUnique.mockResolvedValue(null);

      await expect(service.findCommunes(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
