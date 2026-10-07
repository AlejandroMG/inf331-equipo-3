import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { ListCatalogQueryDto } from './dto/list-catalog-query.dto';

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

    describe('orden', () => {
      const search = (extra: Partial<ListCatalogQueryDto>) =>
        service.findPage({ page: 1, pageSize: 12, ...extra });
      const orderOf = () =>
        (prisma.space.findMany.mock.calls[0] as [{ orderBy: unknown }])[0]
          .orderBy;
      const recent = [{ createdAt: 'desc' }, { id: 'asc' }];

      beforeEach(() => {
        prisma.space.findMany.mockResolvedValue([]);
        prisma.space.count.mockResolvedValue(0);
      });

      it('por defecto, y con sort=recent, los más recientes primero', async () => {
        await search({});
        await search({ sort: 'recent' });

        const [byDefault, explicit] = prisma.space.findMany.mock.calls as Array<
          [{ orderBy: unknown }]
        >;
        expect(byDefault[0].orderBy).toEqual(recent);
        expect(explicit[0].orderBy).toEqual(recent);
      });

      it('por precio de menor a mayor: el de la hora, con los que no tienen al final', async () => {
        await search({ sort: 'price_asc' });

        expect(orderOf()).toEqual([
          { pricePerHour: { sort: 'asc', nulls: 'last' } },
          ...recent,
        ]);
      });

      it('por precio de mayor a menor, también con los que no tienen al final', async () => {
        await search({ sort: 'price_desc' });

        expect(orderOf()).toEqual([
          { pricePerHour: { sort: 'desc', nulls: 'last' } },
          ...recent,
        ]);
      });

      it('con priceUnit=day ordena por el precio por día', async () => {
        await search({ sort: 'price_asc', priceUnit: 'day' });

        expect(orderOf()).toEqual([
          { pricePerDay: { sort: 'asc', nulls: 'last' } },
          ...recent,
        ]);
      });

      it('la unidad sola no cambia el orden por fecha', async () => {
        await search({ priceUnit: 'day' });

        expect(orderOf()).toEqual(recent);
      });

      it('el orden no cambia lo que se busca ni el total', async () => {
        await search({ sort: 'price_desc', typeId: 3 });

        const { where } = (
          prisma.space.findMany.mock.calls[0] as [{ where: unknown }]
        )[0];
        expect(where).toEqual({ status: 'ACTIVE', typeId: 3 });
        expect(prisma.space.count).toHaveBeenCalledWith({ where });
      });
    });

    describe('filtros', () => {
      const search = (filters: Partial<ListCatalogQueryDto>) =>
        service.findPage({ page: 1, pageSize: 12, ...filters });
      const whereOf = () =>
        (prisma.space.findMany.mock.calls[0] as [{ where: unknown }])[0].where;
      // Lo que se espera por cada palabra del texto: está en alguno de los cuatro campos.
      const word = (text: string) => {
        const contains = { contains: text, mode: 'insensitive' };
        return {
          OR: [
            { name: contains },
            { description: contains },
            { type: { name: contains } },
            { commune: { name: contains } },
          ],
        };
      };

      beforeEach(() => {
        prisma.space.findMany.mockResolvedValue([]);
        prisma.space.count.mockResolvedValue(0);
      });

      it('sin filtros no agrega ninguna condición', async () => {
        await search({});

        expect(whereOf()).toEqual({ status: 'ACTIVE' });
      });

      it('filtra por tipo y por comuna', async () => {
        await search({ typeId: 3, communeId: 2 });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          typeId: 3,
          communeId: 2,
        });
      });

      it('filtra por capacidad mínima', async () => {
        await search({ minCapacity: 8 });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          capacity: { gte: 8 },
        });
      });

      it('filtra por rango de precio por hora', async () => {
        await search({ minPrice: 5000, maxPrice: 15000 });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          pricePerHour: { gte: 5000, lte: 15000 },
        });
      });

      it('con solo uno de los extremos, el otro queda abierto', async () => {
        await search({ minPrice: 5000 });
        await search({ maxPrice: 15000 });

        const [first, second] = prisma.space.findMany.mock.calls as Array<
          [{ where: { pricePerHour: Record<string, unknown> } }]
        >;
        expect(first[0].where.pricePerHour).toEqual({ gte: 5000 });
        expect(second[0].where.pricePerHour).toEqual({ lte: 15000 });
      });

      it('con priceUnit=day el rango se aplica al precio por día', async () => {
        await search({ priceUnit: 'day', minPrice: 40000, maxPrice: 90000 });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          pricePerDay: { gte: 40000, lte: 90000 },
        });
      });

      it('con priceUnit=hour, o sin indicarla, el rango es del precio por hora', async () => {
        await search({ priceUnit: 'hour', maxPrice: 15000 });
        await search({ maxPrice: 15000 });

        const [explicit, byDefault] = prisma.space.findMany.mock.calls as Array<
          [{ where: unknown }]
        >;
        const expected = { status: 'ACTIVE', pricePerHour: { lte: 15000 } };
        expect(explicit[0].where).toEqual(expected);
        expect(byDefault[0].where).toEqual(expected);
      });

      it('la unidad sin un rango de precio no agrega ninguna condición', async () => {
        await search({ priceUnit: 'day' });

        expect(whereOf()).toEqual({ status: 'ACTIVE' });
      });

      it('el precio mínimo 0 también es un filtro', async () => {
        await search({ minPrice: 0 });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          pricePerHour: { gte: 0 },
        });
      });

      it('rechaza un precio mínimo mayor que el máximo sin consultar', async () => {
        await expect(
          search({ minPrice: 20000, maxPrice: 10000 }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.space.findMany).not.toHaveBeenCalled();
      });

      it('cada palabra del texto debe estar en el nombre, la descripción, el tipo o la comuna', async () => {
        await search({ q: 'sala Providencia' });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          AND: [word('sala'), word('Providencia')],
        });
      });

      it('separa las palabras por cualquier cantidad de espacios', async () => {
        await search({ q: 'sala   luminosa' });

        expect(whereOf()).toEqual({
          status: 'ACTIVE',
          AND: [word('sala'), word('luminosa')],
        });
      });

      it('escapa los comodines de LIKE para buscarlos como texto', async () => {
        await search({ q: '50% a_b c\\d' });

        const { AND } = whereOf() as {
          AND: Array<{ OR: Array<{ name: { contains: string } }> }>;
        };
        expect(AND.map((word) => word.OR[0].name.contains)).toEqual([
          '50\\%',
          'a\\_b',
          'c\\\\d',
        ]);
      });

      it('usa solo las primeras 5 palabras', async () => {
        await search({ q: 'a b c d e f g' });

        const { AND } = whereOf() as { AND: unknown[] };
        expect(AND).toEqual(['a', 'b', 'c', 'd', 'e'].map(word));
      });

      it('combina los filtros y el total usa las mismas condiciones', async () => {
        await search({ typeId: 1, communeId: 2, minCapacity: 4, q: 'sala' });

        const where = {
          status: 'ACTIVE',
          typeId: 1,
          communeId: 2,
          capacity: { gte: 4 },
          AND: [word('sala')],
        };
        expect(whereOf()).toEqual(where);
        expect(prisma.space.count).toHaveBeenCalledWith({ where });
      });
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
