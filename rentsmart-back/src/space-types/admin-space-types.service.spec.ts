import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminSpaceTypesService,
  normalizeName,
} from './admin-space-types.service';

describe('normalizeName', () => {
  it('quita las tildes y las mayúsculas', () => {
    expect(normalizeName('Cáncha Techada')).toBe('cancha techada');
    expect(normalizeName('ESTUDIO fotográfico')).toBe('estudio fotografico');
  });
});

describe('AdminSpaceTypesService', () => {
  let service: AdminSpaceTypesService;
  const prisma = {
    spaceType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const created = { id: 9, name: 'Nuevo', _count: { spaces: 0 } };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AdminSpaceTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AdminSpaceTypesService);
  });

  it('lista los tipos con cuántos espacios usa cada uno', async () => {
    prisma.spaceType.findMany.mockResolvedValue([
      { id: 1, name: 'Sala', _count: { spaces: 4 } },
    ]);

    await expect(service.list()).resolves.toEqual([
      { id: 1, name: 'Sala', spaces: 4 },
    ]);
  });

  it('crea un tipo con un nombre libre', async () => {
    prisma.spaceType.findMany.mockResolvedValue([{ id: 1, name: 'Sala' }]);
    prisma.spaceType.create.mockResolvedValue(created);

    await expect(service.create('Nuevo')).resolves.toEqual({
      id: 9,
      name: 'Nuevo',
      spaces: 0,
    });
    expect(prisma.spaceType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Nuevo' } }),
    );
  });

  it.each(['Hotel boutique', 'CABAÑAS de montaña', 'Alojamiento', 'Habitación'])(
    'rechaza el alojamiento «%s» con 400',
    async (name) => {
      await expect(service.create(name)).rejects.toThrow(BadRequestException);
      expect(prisma.spaceType.create).not.toHaveBeenCalled();
    },
  );

  it('rechaza un nombre que ya existe, sin distinguir mayúsculas ni tildes', async () => {
    prisma.spaceType.findMany.mockResolvedValue([{ id: 1, name: 'Cancha' }]);

    await expect(service.create('CÁNCHA')).rejects.toThrow(ConflictException);
  });

  it('al renombrar, el propio tipo no cuenta como repetido', async () => {
    prisma.spaceType.findUnique.mockResolvedValue({ id: 1 });
    prisma.spaceType.findMany.mockResolvedValue([{ id: 1, name: 'Cancha' }]);
    prisma.spaceType.update.mockResolvedValue({
      id: 1,
      name: 'CANCHA',
      _count: { spaces: 2 },
    });

    await expect(service.rename(1, 'CANCHA')).resolves.toMatchObject({
      name: 'CANCHA',
      spaces: 2,
    });
  });

  it('renombrar un tipo que no existe da 404, también con un id fuera de rango, sin consultar', async () => {
    prisma.spaceType.findUnique.mockResolvedValue(null);

    await expect(service.rename(5, 'Algo')).rejects.toThrow(NotFoundException);
    await expect(service.rename(0, 'Algo')).rejects.toThrow(NotFoundException);
    await expect(service.rename(99_999_999_999, 'Algo')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.spaceType.findUnique).toHaveBeenCalledTimes(1);
  });
});
