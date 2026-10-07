import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { approximateLocation } from './approximate-location';
import { CatalogDetailDto } from './dto/catalog-detail.dto';
import { CatalogPageDto } from './dto/catalog-page.dto';
import {
  CatalogSort,
  ListCatalogQueryDto,
  PriceUnit,
} from './dto/list-catalog-query.dto';

// Solo los espacios activos son públicos: borradores, inactivos y bloqueados no aparecen en ninguna consulta.
const PUBLIC = { status: SpaceStatus.ACTIVE } as const;

/** Cuántas palabras de la búsqueda se usan; las demás se ignoran para no armar consultas enormes. */
const MAX_SEARCH_WORDS = 5;

/** `contains` de Prisma no escapa los comodines de LIKE: sin esto, buscar "%" o "_" encontraría todo. */
const escapeLike = (word: string) => word.replace(/[\\%_]/g, '\\$&');

/**
 * Cada palabra del texto debe aparecer en el nombre, la descripción, el tipo o la comuna (sin distinguir
 * mayúsculas), y todas las palabras deben cumplirse: "sala providencia" encuentra una sala en Providencia.
 */
function searchFilter(q: string | undefined): Prisma.SpaceWhereInput[] {
  if (!q) return [];
  return q
    .split(/\s+/)
    .slice(0, MAX_SEARCH_WORDS)
    .map((word) => {
      const contains = {
        contains: escapeLike(word),
        mode: 'insensitive',
      } as const;
      return {
        OR: [
          { name: contains },
          { description: contains },
          { type: { name: contains } },
          { commune: { name: contains } },
        ],
      };
    });
}

/**
 * El orden de la lista. Por defecto, los más recientes primero. Por precio, el de la hora o el del día según
 * `priceUnit`: los espacios que no se arriendan en esa unidad (precio null) van al final, en cualquier dirección.
 * Siempre se desempata por fecha y por id, así la paginación es estable aunque haya precios iguales.
 */
function orderBy(
  sort: CatalogSort | undefined,
  priceUnit: PriceUnit | undefined,
): Prisma.SpaceOrderByWithRelationInput[] {
  const recent = [{ createdAt: 'desc' as const }, { id: 'asc' as const }];
  if (sort !== 'price_asc' && sort !== 'price_desc') return recent;
  const price = {
    sort: sort === 'price_asc' ? ('asc' as const) : ('desc' as const),
    nulls: 'last' as const,
  };
  return [
    priceUnit === 'day' ? { pricePerDay: price } : { pricePerHour: price },
    ...recent,
  ];
}

/**
 * Consultas públicas del catálogo. El `select` es una lista blanca: lo que no se pide aquí
 * (addressDetail, ownerId, status…) no sale nunca por la API pública (P-09).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage({
    page,
    pageSize,
    typeId,
    communeId,
    minPrice,
    maxPrice,
    priceUnit,
    minCapacity,
    q,
    sort,
  }: ListCatalogQueryDto): Promise<CatalogPageDto> {
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new BadRequestException(
        'El precio mínimo no puede superar al máximo',
      );
    }
    const words = searchFilter(q);
    // El rango se aplica al precio por hora o por día, según priceUnit: un espacio que no se arrienda en esa
    // unidad (precio null) no cumple un filtro de precio.
    const range = { gte: minPrice, lte: maxPrice };
    const where: Prisma.SpaceWhereInput = {
      ...PUBLIC,
      ...(typeId !== undefined && { typeId }),
      ...(communeId !== undefined && { communeId }),
      ...(minCapacity !== undefined && { capacity: { gte: minCapacity } }),
      ...((minPrice !== undefined || maxPrice !== undefined) &&
        (priceUnit === 'day'
          ? { pricePerDay: range }
          : { pricePerHour: range })),
      ...(words.length > 0 && { AND: words }),
    };

    const [spaces, total] = await this.prisma.$transaction([
      this.prisma.space.findMany({
        where,
        orderBy: orderBy(sort, priceUnit),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          capacity: true,
          pricePerHour: true,
          pricePerDay: true,
          type: { select: { name: true } },
          commune: { select: { name: true } },
          photos: {
            select: { url: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.space.count({ where }),
    ]);

    return {
      items: spaces.map((space) => ({
        id: space.id,
        name: space.name,
        // Un espacio activo ya pasó las reglas de publicación (ES-04), pero el schema los deja opcionales.
        typeName: space.type?.name ?? '',
        communeName: space.commune?.name ?? '',
        capacity: space.capacity ?? 0,
        pricePerHour: space.pricePerHour,
        pricePerDay: space.pricePerDay,
        coverUrl: space.photos[0]?.url ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<CatalogDetailDto> {
    const space = await this.prisma.space.findFirst({
      where: { id, ...PUBLIC },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        capacity: true,
        pricePerHour: true,
        pricePerDay: true,
        rules: true,
        type: { select: { name: true } },
        commune: { select: { name: true, region: { select: { name: true } } } },
        amenities: { select: { amenity: { select: { name: true } } } },
        photos: {
          select: { id: true, url: true, position: true },
          orderBy: { position: 'asc' },
        },
        rulesWeek: {
          select: { weekday: true, startTime: true, endTime: true },
          orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
    if (!space) throw new NotFoundException('El espacio no existe');

    return {
      id: space.id,
      name: space.name,
      description: space.description,
      typeName: space.type?.name ?? '',
      regionName: space.commune?.region.name ?? '',
      communeName: space.commune?.name ?? '',
      address: space.address,
      location: approximateLocation(space.latitude, space.longitude),
      capacity: space.capacity ?? 0,
      pricePerHour: space.pricePerHour,
      pricePerDay: space.pricePerDay,
      rules: space.rules,
      amenities: space.amenities
        .map((item) => item.amenity.name)
        .sort((a, b) => a.localeCompare(b, 'es')),
      photos: space.photos,
      schedule: space.rulesWeek,
    };
  }
}
