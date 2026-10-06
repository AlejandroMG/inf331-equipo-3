import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

// Cada test crea sus propios datos con un sufijo único, así no depende del seed ni choca con él.
// Todos los nombres de espacio llevan el sufijo: buscarlo como texto acota la consulta a estos datos.
const SUFFIX = `e2e-flt-${Date.now()}`;
const SECRET_WORD = `secretisima${Date.now()}`;

interface CatalogBody {
  items: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  pageSize: number;
}

describe('Filtros y búsqueda del catálogo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let regionId: number;
  const types: Record<string, number> = {};
  const communes: Record<string, number> = {};
  const ids: Record<string, string> = {};

  const server = () => app.getHttpServer();
  const get = async (query: string) =>
    (await request(server()).get(`/api/catalog?${query}`).expect(200)).body as CatalogBody;
  /** Los nombres (sin el sufijo) de los espacios que devuelve la consulta, ordenados. */
  const found = async (query: string, text = '') => {
    const q = encodeURIComponent(`${text} ${SUFFIX}`.trim());
    const body = await get(`pageSize=50&${query}${query ? '&' : ''}q=${q}`);
    return body.items.map((item) => item.name.replace(` ${SUFFIX}`, '')).sort();
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    ownerId = (
      await prisma.user.create({
        data: {
          email: `owner-${SUFFIX}@rentsmart.test`,
          passwordHash: 'no-es-un-hash-real',
          name: 'Propietario e2e',
          isHost: true,
        },
      })
    ).id;
    types.auditorio = (await prisma.spaceType.create({ data: { name: `Auditorio ${SUFFIX}` } })).id;
    types.galpon = (await prisma.spaceType.create({ data: { name: `Galpón ${SUFFIX}` } })).id;
    const region = await prisma.region.create({
      data: {
        name: `Región ${SUFFIX}`,
        communes: { create: [{ name: `Barrio Lindo ${SUFFIX}` }, { name: `Barrio Norte ${SUFFIX}` }] },
      },
      include: { communes: true },
    });
    regionId = region.id;
    communes.lindo = region.communes.find((c) => c.name.startsWith('Barrio Lindo'))!.id;
    communes.norte = region.communes.find((c) => c.name.startsWith('Barrio Norte'))!.id;

    const create = (key: string, data: Record<string, unknown>) =>
      prisma.space
        .create({
          data: {
            ownerId,
            regionId,
            status: 'ACTIVE',
            name: `${key} ${SUFFIX}`,
            address: 'Av. Pública 123',
            ...data,
          } as never,
        })
        .then((space) => {
          ids[key] = space.id;
        });

    // Del más nuevo al más viejo: A, B, C, D.
    await create('Sala Alameda', {
      typeId: types.auditorio, communeId: communes.lindo, description: 'Luminosa con proyector', capacity: 4,
      pricePerHour: 10000, pricePerDay: null, createdAt: new Date('2001-04-01'), addressDetail: `Oficina ${SECRET_WORD}`,
    });
    await create('Sala Bellavista', {
      typeId: types.auditorio, communeId: communes.norte, description: 'Amplia y silenciosa', capacity: 10,
      pricePerHour: 20000, pricePerDay: 90000, createdAt: new Date('2001-03-01'),
    });
    await create('Estudio Cámara', {
      typeId: types.galpon, communeId: communes.lindo, description: 'Fondo infinito', capacity: 20,
      pricePerHour: 15000, pricePerDay: 60000, createdAt: new Date('2001-02-01'),
    });
    // Solo se arrienda por día: ningún filtro de precio (por hora) lo incluye.
    await create('Taller Norte', {
      typeId: types.galpon, communeId: communes.norte, description: 'Herramientas incluidas', capacity: 6,
      pricePerHour: null, pricePerDay: 50000, createdAt: new Date('2001-01-01'),
    });
    // Cumplen los filtros, pero no están activos: no deben aparecer nunca.
    await create('Sala Borrador', {
      status: 'DRAFT', typeId: types.auditorio, communeId: communes.lindo, description: 'x', capacity: 10, pricePerHour: 12000,
    });
    await create('Sala Inactiva', {
      status: 'INACTIVE', typeId: types.auditorio, communeId: communes.lindo, description: 'x', capacity: 10, pricePerHour: 12000,
    });
  });

  afterAll(async () => {
    await prisma.space.deleteMany({ where: { ownerId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.commune.deleteMany({ where: { regionId } });
    await prisma.region.delete({ where: { id: regionId } });
    await prisma.spaceType.deleteMany({ where: { id: { in: Object.values(types) } } });
    await app.close();
  });

  it('sin filtros trae solo los activos', async () => {
    expect(await found('')).toEqual(['Estudio Cámara', 'Sala Alameda', 'Sala Bellavista', 'Taller Norte']);
  });

  describe('tipo y comuna', () => {
    it('filtra por tipo', async () => {
      expect(await found(`typeId=${types.auditorio}`)).toEqual(['Sala Alameda', 'Sala Bellavista']);
      expect(await found(`typeId=${types.galpon}`)).toEqual(['Estudio Cámara', 'Taller Norte']);
    });

    it('filtra por comuna', async () => {
      expect(await found(`communeId=${communes.lindo}`)).toEqual(['Estudio Cámara', 'Sala Alameda']);
      expect(await found(`communeId=${communes.norte}`)).toEqual(['Sala Bellavista', 'Taller Norte']);
    });

    it('un tipo o una comuna que no existen dan una lista vacía, no un error', async () => {
      const body = await get('typeId=2000000000&communeId=2000000000');

      expect(body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('capacidad mínima', () => {
    it('trae los espacios para esa cantidad de personas o más', async () => {
      expect(await found('minCapacity=4')).toEqual(['Estudio Cámara', 'Sala Alameda', 'Sala Bellavista', 'Taller Norte']);
      expect(await found('minCapacity=7')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
      expect(await found('minCapacity=10')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
      expect(await found('minCapacity=20')).toEqual(['Estudio Cámara']);
      expect(await found('minCapacity=21')).toEqual([]);
    });
  });

  describe('rango de precio por día', () => {
    it('con priceUnit=day el rango es el del precio por día, con los extremos incluidos', async () => {
      expect(await found('priceUnit=day&minPrice=50000&maxPrice=60000')).toEqual(['Estudio Cámara', 'Taller Norte']);
      expect(await found('priceUnit=day&minPrice=60000')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
      expect(await found('priceUnit=day&maxPrice=55000')).toEqual(['Taller Norte']);
    });

    it('deja fuera los espacios que no se arriendan por día, incluso con mínimo 0', async () => {
      expect(await found('priceUnit=day&minPrice=0')).toEqual(['Estudio Cámara', 'Sala Bellavista', 'Taller Norte']);
    });

    it('con priceUnit=hour el rango es el del precio por hora, igual que sin indicarla', async () => {
      expect(await found('priceUnit=hour&minPrice=15000&maxPrice=20000')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
    });

    it('la unidad sola, sin un rango de precio, no filtra nada', async () => {
      expect(await found('priceUnit=day')).toEqual(['Estudio Cámara', 'Sala Alameda', 'Sala Bellavista', 'Taller Norte']);
    });

    it('el rango por día se combina con los otros filtros', async () => {
      expect(await found(`priceUnit=day&maxPrice=60000&communeId=${communes.lindo}`)).toEqual(['Estudio Cámara']);
    });
  });

  describe('rango de precio por hora', () => {
    it('incluye los extremos', async () => {
      expect(await found('minPrice=15000&maxPrice=20000')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
      expect(await found('minPrice=10000&maxPrice=10000')).toEqual(['Sala Alameda']);
    });

    it('con un solo extremo, el otro queda abierto', async () => {
      expect(await found('minPrice=15000')).toEqual(['Estudio Cámara', 'Sala Bellavista']);
      expect(await found('maxPrice=15000')).toEqual(['Estudio Cámara', 'Sala Alameda']);
    });

    it('deja fuera los espacios que no se arriendan por hora, incluso con mínimo 0', async () => {
      expect(await found('minPrice=0')).toEqual(['Estudio Cámara', 'Sala Alameda', 'Sala Bellavista']);
    });

    it('un rango sin espacios da una lista vacía', async () => {
      expect(await found('minPrice=30000&maxPrice=40000')).toEqual([]);
    });
  });

  describe('texto libre', () => {
    it('busca en el nombre sin distinguir mayúsculas', async () => {
      expect(await found('', 'bellavista')).toEqual(['Sala Bellavista']);
      expect(await found('', 'ALAMEDA')).toEqual(['Sala Alameda']);
      expect(await found('', 'sala')).toEqual(['Sala Alameda', 'Sala Bellavista']);
    });

    it('busca en la descripción', async () => {
      expect(await found('', 'proyector')).toEqual(['Sala Alameda']);
      expect(await found('', 'silenciosa')).toEqual(['Sala Bellavista']);
    });

    it('busca en el nombre del tipo, también con tildes', async () => {
      expect(await found('', 'auditorio')).toEqual(['Sala Alameda', 'Sala Bellavista']);
      expect(await found('', 'galpón')).toEqual(['Estudio Cámara', 'Taller Norte']);
    });

    it('busca en el nombre de la comuna', async () => {
      expect(await found('', 'lindo')).toEqual(['Estudio Cámara', 'Sala Alameda']);
    });

    it('exige todas las palabras, cada una en cualquiera de esos campos', async () => {
      expect(await found('', 'sala proyector')).toEqual(['Sala Alameda']);
      expect(await found('', 'sala lindo')).toEqual(['Sala Alameda']);
      expect(await found('', 'sala galpón')).toEqual([]);
    });

    it('un texto en blanco es como no buscar', async () => {
      const body = await get(`pageSize=50&typeId=${types.auditorio}&q=%20%20`);

      expect(body.items.map((i) => i.name.replace(` ${SUFFIX}`, '')).sort()).toEqual(['Sala Alameda', 'Sala Bellavista']);
    });

    it('% y _ se buscan como texto, no como comodines', async () => {
      expect((await get(`typeId=${types.auditorio}&q=%25`)).items).toEqual([]);
      expect((await get(`typeId=${types.auditorio}&q=_`)).items).toEqual([]);
    });

    it('no revela el detalle privado de la dirección: buscarlo no encuentra nada', async () => {
      const body = await get(`q=${SECRET_WORD}`);

      expect(body.items).toEqual([]);
      expect(JSON.stringify(body)).not.toContain(SECRET_WORD);
    });

    it('acepta un texto de 100 caracteres', async () => {
      await get(`q=${'a'.repeat(100)}`);
    });
  });

  describe('combinados', () => {
    it('todos los filtros deben cumplirse', async () => {
      expect(await found(`typeId=${types.auditorio}&communeId=${communes.lindo}`)).toEqual(['Sala Alameda']);
      expect(await found(`typeId=${types.auditorio}&minCapacity=10`)).toEqual(['Sala Bellavista']);
      expect(await found(`communeId=${communes.lindo}&minPrice=12000&maxPrice=20000`)).toEqual(['Estudio Cámara']);
      expect(await found(`typeId=${types.galpon}&minCapacity=10`, 'estudio')).toEqual(['Estudio Cámara']);
      expect(await found(`typeId=${types.galpon}&minCapacity=10`, 'taller')).toEqual([]);
    });
  });

  describe('paginación con filtros', () => {
    it('el total es el de los espacios que cumplen y se pagina sobre ellos', async () => {
      const first = await get(`typeId=${types.auditorio}&pageSize=1&page=1`);
      const second = await get(`typeId=${types.auditorio}&pageSize=1&page=2`);
      const beyond = await get(`typeId=${types.auditorio}&pageSize=1&page=3`);

      expect(first.items.map((i) => i.id)).toEqual([ids['Sala Alameda']]);
      expect(second.items.map((i) => i.id)).toEqual([ids['Sala Bellavista']]);
      expect([first.total, second.total, beyond.total]).toEqual([2, 2, 2]);
      expect(beyond.items).toEqual([]);
    });
  });

  describe('parámetros inválidos', () => {
    it.each([
      'typeId=abc',
      'typeId=0',
      'typeId=1.5',
      'typeId=1&typeId=2',
      'typeId=99999999999',
      'communeId=-1',
      'communeId=abc',
      'priceUnit=week',
      'priceUnit=',
      'minPrice=-1',
      'minPrice=abc',
      'maxPrice=1.5',
      'maxPrice=10000001',
      'minCapacity=0',
      'minCapacity=1001',
      'minCapacity=abc',
    ])('responde 400 con %s', (query) => request(server()).get(`/api/catalog?${query}`).expect(400));

    it('responde 400 con un texto de más de 100 caracteres', () => {
      return request(server()).get(`/api/catalog?q=${'a'.repeat(101)}`).expect(400);
    });

    it('responde 400 si el precio mínimo supera al máximo', async () => {
      const { body } = await request(server()).get('/api/catalog?minPrice=20000&maxPrice=10000').expect(400);

      expect((body as { message: string }).message).toBe('El precio mínimo no puede superar al máximo');
    });

    it('sigue rechazando los parámetros desconocidos', () => {
      return request(server()).get('/api/catalog?color=rojo').expect(400);
    });
  });
});
