import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
  let service: SpacesService;
  const prisma = {
    space: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    spaceType: { findUnique: jest.fn() },
    amenity: { count: jest.fn() },
    commune: { findUnique: jest.fn() },
    region: { findUnique: jest.fn() },
  };
  const row = {
    id: 's1',
    status: 'DRAFT',
    name: 'Sala',
    amenities: [{ amenityId: 2 }, { amenityId: 5 }],
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [SpacesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SpacesService);
  });

  describe('create', () => {
    it('crea siempre en borrador y a nombre del usuario', async () => {
      prisma.space.create.mockResolvedValue(row);

      await service.create('u1', { name: 'Sala' });

      expect(prisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'u1',
            status: 'DRAFT',
            name: 'Sala',
          }) as unknown,
        }),
      );
    });

    it('devuelve el equipamiento como lista de ids', async () => {
      prisma.space.create.mockResolvedValue(row);

      const space = await service.create('u1', { name: 'Sala' });

      expect(space.amenityIds).toEqual([2, 5]);
      expect(space).not.toHaveProperty('amenities');
    });

    it('guarda la región de la comuna cuando solo se manda la comuna', async () => {
      prisma.commune.findUnique.mockResolvedValue({ regionId: 7 });
      prisma.space.create.mockResolvedValue(row);

      await service.create('u1', { name: 'Sala', communeId: 3 });

      const { data } = prisma.space.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.regionId).toBe(7);
      expect(data.communeId).toBe(3);
    });

    it('rechaza una comuna que no es de la región', async () => {
      prisma.commune.findUnique.mockResolvedValue({ regionId: 7 });

      await expect(
        service.create('u1', { name: 'Sala', regionId: 8, communeId: 3 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.space.create).not.toHaveBeenCalled();
    });

    it('rechaza un tipo que no existe', async () => {
      prisma.spaceType.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', { name: 'Sala', typeId: 99 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza equipamiento que no existe', async () => {
      prisma.amenity.count.mockResolvedValue(1);

      await expect(
        service.create('u1', { name: 'Sala', amenityIds: [1, 2] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('lanza 404 si el espacio no existe', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.update('u1', 'x', { name: 'N' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 403 si el espacio es de otro y no modifica nada', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...row, ownerId: 'otro' });

      await expect(service.update('u1', 's1', { name: 'N' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.space.update).not.toHaveBeenCalled();
    });

    it('no deja borrar el nombre', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...row, ownerId: 'u1' });

      await expect(service.update('u1', 's1', { name: null })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reemplaza el equipamiento solo si viene en la petición', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...row, ownerId: 'u1' });
      prisma.space.update.mockResolvedValue(row);

      await service.update('u1', 's1', { description: 'Hola' });
      const withoutAmenities = prisma.space.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(withoutAmenities.data).not.toHaveProperty('amenities');

      prisma.amenity.count.mockResolvedValue(1);
      await service.update('u1', 's1', { amenityIds: [4] });
      const withAmenities = prisma.space.update.mock.calls[1][0] as {
        data: Record<string, unknown>;
      };
      expect(withAmenities.data.amenities).toEqual({
        deleteMany: {},
        create: [{ amenityId: 4 }],
      });
    });
  });

  describe('punto en el mapa', () => {
    const point = { latitude: -33.4489, longitude: -70.6693 };
    const dataOf = (mock: jest.Mock, call = 0) =>
      (mock.mock.calls[call][0] as { data: Record<string, unknown> }).data;

    it('crea el espacio con el punto que marcó el propietario', async () => {
      prisma.space.create.mockResolvedValue(row);

      await service.create('u1', { name: 'Sala', ...point });

      expect(dataOf(prisma.space.create)).toMatchObject(point);
    });

    it('al crear rechaza una latitud sin longitud, y al revés', async () => {
      await expect(
        service.create('u1', { name: 'Sala', latitude: -33.4 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('u1', { name: 'Sala', longitude: -70.6 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.space.create).not.toHaveBeenCalled();
    });

    it('al crear, los dos en null equivalen a no marcar nada', async () => {
      prisma.space.create.mockResolvedValue(row);

      await service.create('u1', {
        name: 'Sala',
        latitude: null,
        longitude: null,
      });

      expect(prisma.space.create).toHaveBeenCalled();
    });

    it('marca el punto en un espacio que no lo tenía', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        latitude: null,
        longitude: null,
      });
      prisma.space.update.mockResolvedValue(row);

      await service.update('u1', 's1', point);

      expect(dataOf(prisma.space.update)).toMatchObject(point);
    });

    it('rechaza marcar solo la latitud si el espacio no tenía punto', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        latitude: null,
        longitude: null,
      });

      await expect(
        service.update('u1', 's1', { latitude: -33.4 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.space.update).not.toHaveBeenCalled();
    });

    it('con un punto ya marcado deja mover solo una de las dos', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        ...point,
      });
      prisma.space.update.mockResolvedValue(row);

      await service.update('u1', 's1', { latitude: -33.5 });

      expect(dataOf(prisma.space.update)).toMatchObject({ latitude: -33.5 });
    });

    it('con un punto ya marcado no deja borrar solo una de las dos', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        ...point,
      });

      await expect(
        service.update('u1', 's1', { latitude: null }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.space.update).not.toHaveBeenCalled();
    });

    it('con null en las dos se borra el punto', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        ...point,
      });
      prisma.space.update.mockResolvedValue(row);

      await service.update('u1', 's1', { latitude: null, longitude: null });

      expect(dataOf(prisma.space.update)).toMatchObject({
        latitude: null,
        longitude: null,
      });
    });

    it('si la petición no habla del punto, no lo toca', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        ...point,
      });
      prisma.space.update.mockResolvedValue(row);

      await service.update('u1', 's1', { description: 'Hola' });

      const data = dataOf(prisma.space.update);
      expect(data).not.toHaveProperty('latitude');
      expect(data).not.toHaveProperty('longitude');
    });

    it('el propietario recibe el punto exacto', async () => {
      prisma.space.findUnique.mockResolvedValue({
        ...row,
        ownerId: 'u1',
        ...point,
      });

      await expect(service.findOne('u1', 's1')).resolves.toMatchObject(point);
    });
  });

  describe('update de un espacio publicado', () => {
    const active = {
      ...row,
      ownerId: 'u1',
      status: 'ACTIVE',
      typeId: 1,
      description: 'Sala',
      capacity: 8,
      communeId: 2,
      pricePerHour: 9000,
      pricePerDay: null,
      _count: { photos: 2, rulesWeek: 5 },
    };

    beforeEach(() => {
      prisma.space.findUnique.mockResolvedValue(active);
      prisma.space.update.mockResolvedValue(row);
      prisma.spaceType.findUnique.mockResolvedValue({ id: 1 });
    });

    it('deja cambiar el precio y otros datos sin perder lo necesario', async () => {
      await service.update('u1', 's1', { pricePerHour: 12000, rules: null });

      expect(prisma.space.update).toHaveBeenCalled();
    });

    it('deja cambiar de precio por hora a solo por día', async () => {
      await service.update('u1', 's1', { pricePerHour: null, pricePerDay: 50000 });

      expect(prisma.space.update).toHaveBeenCalled();
    });

    it.each([
      ['price', { pricePerHour: null }],
      ['description', { description: '  ' }],
      ['description', { description: null }],
      ['capacity', { capacity: null }],
      ['type', { typeId: null }],
      ['commune', { communeId: null }],
    ])(
      'rechaza con 409 dejar sin %s a un espacio publicado',
      async (field, patch) => {
        await expect(service.update('u1', 's1', patch)).rejects.toMatchObject({
          missing: [field],
        });
        expect(prisma.space.update).not.toHaveBeenCalled();
      },
    );

    it('un borrador sí puede quedar incompleto', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...active, status: 'DRAFT' });

      await service.update('u1', 's1', { pricePerHour: null, description: null });

      expect(prisma.space.update).toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    const base = {
      id: 's1',
      status: 'DRAFT',
      name: 'Sala',
      typeId: 1,
      description: 'x',
      capacity: 4,
      communeId: 2,
      pricePerHour: 5000,
      pricePerDay: null,
      updatedAt: new Date('2026-10-05T12:00:00Z'),
      type: { name: 'Sala de reuniones' },
      commune: { name: 'Santiago' },
      photos: [{ url: '/api/uploads/a.png' }],
      _count: { photos: 1, rulesWeek: 5 },
    };

    it('pide solo los espacios del usuario, los más recientes primero', async () => {
      prisma.space.findMany.mockResolvedValue([]);

      await expect(service.findMine('u1')).resolves.toEqual([]);

      expect(prisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'u1' },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('arma el resumen con la portada y sin lo que falta si está completo', async () => {
      prisma.space.findMany.mockResolvedValue([base]);

      await expect(service.findMine('u1')).resolves.toEqual([
        {
          id: 's1',
          status: 'DRAFT',
          name: 'Sala',
          typeName: 'Sala de reuniones',
          communeName: 'Santiago',
          pricePerHour: 5000,
          pricePerDay: null,
          coverUrl: '/api/uploads/a.png',
          missing: [],
          updatedAt: base.updatedAt,
        },
      ]);
    });

    it('con datos sin completar deja los nombres y la portada en null y lista lo que falta', async () => {
      prisma.space.findMany.mockResolvedValue([
        {
          ...base,
          typeId: null,
          type: null,
          communeId: null,
          commune: null,
          photos: [],
          pricePerHour: null,
          _count: { photos: 0, rulesWeek: 0 },
        },
      ]);

      const [space] = await service.findMine('u1');

      expect(space.typeName).toBeNull();
      expect(space.communeName).toBeNull();
      expect(space.coverUrl).toBeNull();
      expect(space.missing).toEqual(['type', 'commune', 'price', 'photos', 'schedule']);
    });

    it('no devuelve datos internos ni privados', async () => {
      prisma.space.findMany.mockResolvedValue([{ ...base, ownerId: 'u1', addressDetail: 'secreto' }]);

      const [space] = await service.findMine('u1');

      expect(space).not.toHaveProperty('ownerId');
      expect(space).not.toHaveProperty('addressDetail');
      expect(space).not.toHaveProperty('_count');
    });
  });

  describe('findOne', () => {
    it('devuelve el espacio al dueño sin exponer ownerId', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...row, ownerId: 'u1' });

      const space = await service.findOne('u1', 's1');

      expect(space.id).toBe('s1');
      expect(space).not.toHaveProperty('ownerId');
    });

    it('lanza 403 a otro usuario', async () => {
      prisma.space.findUnique.mockResolvedValue({ ...row, ownerId: 'otro' });

      await expect(service.findOne('u1', 's1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
