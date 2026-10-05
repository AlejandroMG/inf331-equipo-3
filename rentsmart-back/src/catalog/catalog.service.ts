import { Injectable, NotFoundException } from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogDetailDto } from './dto/catalog-detail.dto';
import { CatalogPageDto } from './dto/catalog-page.dto';
import { ListCatalogQueryDto } from './dto/list-catalog-query.dto';

// Solo los espacios activos son públicos: borradores, inactivos y bloqueados no aparecen en ninguna consulta.
const PUBLIC = { status: SpaceStatus.ACTIVE } as const;

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
  }: ListCatalogQueryDto): Promise<CatalogPageDto> {
    const [spaces, total] = await this.prisma.$transaction([
      this.prisma.space.findMany({
        where: PUBLIC,
        // Más recientes primero; el id desempata para que la paginación sea estable.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
      this.prisma.space.count({ where: PUBLIC }),
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
