import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CATALOG_ITEM_SELECT,
  PUBLIC,
  toCatalogItem,
} from './catalog.service';
import { CatalogPageDto } from './dto/catalog-page.dto';

/** Tope de favoritos por usuario: evita una lista sin fondo y consultas enormes. */
export const MAX_FAVORITES = 200;

/**
 * Favoritos del usuario (BU-08). Solo se pueden guardar espacios activos y solo se listan los que siguen activos:
 * uno que se desactiva deja de verse, pero no se pierde, y reaparece si se vuelve a activar.
 */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Los favoritos del usuario como tarjetas del catálogo, los guardados más recientemente primero. */
  async list(
    userId: string,
    { page, pageSize }: { page: number; pageSize: number },
  ): Promise<CatalogPageDto> {
    const where = { userId, space: PUBLIC };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { spaceId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { space: { select: CATALOG_ITEM_SELECT } },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return {
      items: rows.map((row) => toCatalogItem(row.space)),
      total,
      page,
      pageSize,
    };
  }

  /** Solo los ids, para marcar el corazón en las tarjetas sin pedir cada espacio. */
  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, space: PUBLIC },
      orderBy: [{ createdAt: 'desc' }, { spaceId: 'asc' }],
      select: { spaceId: true },
    });
    return rows.map((row) => row.spaceId);
  }

  /** Guarda un espacio. Es idempotente: guardar uno que ya es favorito no cambia nada. */
  async add(userId: string, spaceId: string): Promise<void> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, ...PUBLIC },
      select: { id: true },
    });
    if (!space) throw new NotFoundException('El espacio no existe');

    const key = { userId_spaceId: { userId, spaceId } };
    const existing = await this.prisma.favorite.findUnique({ where: key });
    if (existing) return;
    if ((await this.prisma.favorite.count({ where: { userId } })) >= MAX_FAVORITES) {
      throw new ConflictException(
        `Llegaste al máximo de ${MAX_FAVORITES} favoritos: quita alguno para guardar otro`,
      );
    }
    // upsert y no create: dos peticiones a la vez no deben fallar por la clave repetida.
    await this.prisma.favorite.upsert({
      where: key,
      create: { userId, spaceId },
      update: {},
    });
  }

  /** Quita un favorito. Es idempotente: quitar uno que no estaba no es un error. */
  async remove(userId: string, spaceId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, spaceId } });
  }
}
