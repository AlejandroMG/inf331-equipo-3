import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminSpaceDto,
  AdminSpacesPageDto,
  ListAdminSpacesQueryDto,
} from './dto/admin-space.dto';

const SELECT = {
  id: true,
  name: true,
  status: true,
  blockedReason: true,
  blockedAt: true,
  updatedAt: true,
  owner: { select: { name: true, email: true } },
  type: { select: { name: true } },
  commune: { select: { name: true } },
} as const;

type Row = Prisma.SpaceGetPayload<{ select: typeof SELECT }>;

const toDto = (space: Row): AdminSpaceDto => ({
  id: space.id,
  name: space.name,
  status: space.status,
  ownerName: space.owner.name,
  ownerEmail: space.owner.email,
  typeName: space.type?.name ?? null,
  communeName: space.commune?.name ?? null,
  blockedReason: space.blockedReason,
  blockedAt: space.blockedAt,
  updatedAt: space.updatedAt,
});

/** `contains` de Prisma no escapa los comodines de LIKE: sin esto, buscar "%" o "_" encontraría todo. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** Los estados desde los que un administrador puede despublicar: un borrador no está publicado. */
const BLOCKABLE: SpaceStatus[] = [SpaceStatus.ACTIVE, SpaceStatus.INACTIVE];

/**
 * Moderación de espacios por un administrador (AD-02): ver todos los espacios, despublicar (bloquear) uno con un
 * motivo y desbloquearlo. Un espacio bloqueado sale del catálogo y su propietario no puede activarlo.
 */
@Injectable()
export class AdminSpacesService {
  constructor(private readonly prisma: PrismaService) {}

  async list({
    page,
    pageSize,
    status,
    q,
  }: ListAdminSpacesQueryDto): Promise<AdminSpacesPageDto> {
    const text = q?.trim();
    const where: Prisma.SpaceWhereInput = {
      ...(status !== undefined && { status }),
      ...(text && {
        OR: [
          { name: { contains: escapeLike(text), mode: 'insensitive' } },
          { owner: { name: { contains: escapeLike(text), mode: 'insensitive' } } },
          { owner: { email: { contains: escapeLike(text), mode: 'insensitive' } } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.space.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: SELECT,
      }),
      this.prisma.space.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }

  /** Bloquea un espacio publicado o desactivado, con el motivo. 409 si es un borrador o ya está bloqueado. */
  async block(id: string, reason: string): Promise<AdminSpaceDto> {
    const space = await this.find(id);
    if (!BLOCKABLE.includes(space.status)) {
      throw new ConflictException(
        space.status === SpaceStatus.BLOCKED
          ? 'El espacio ya está bloqueado'
          : 'Un borrador no está publicado: no hay nada que bloquear',
      );
    }
    // Solo si sigue en el estado que se leyó: dos administradores a la vez no se pisan.
    const { count } = await this.prisma.space.updateMany({
      where: { id, status: { in: BLOCKABLE } },
      data: {
        status: SpaceStatus.BLOCKED,
        blockedReason: reason,
        blockedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('El estado del espacio cambió: recarga e inténtalo de nuevo');
    }
    return this.get(id);
  }

  /** Desbloquea un espacio: queda desactivado y su propietario decide cuándo volver a activarlo. */
  async unblock(id: string): Promise<AdminSpaceDto> {
    const space = await this.find(id);
    if (space.status !== SpaceStatus.BLOCKED) {
      throw new ConflictException('El espacio no está bloqueado');
    }
    const { count } = await this.prisma.space.updateMany({
      where: { id, status: SpaceStatus.BLOCKED },
      data: {
        status: SpaceStatus.INACTIVE,
        blockedReason: null,
        blockedAt: null,
      },
    });
    if (count === 0) {
      throw new ConflictException('El estado del espacio cambió: recarga e inténtalo de nuevo');
    }
    return this.get(id);
  }

  private async find(id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    return space;
  }

  private async get(id: string): Promise<AdminSpaceDto> {
    const space = await this.prisma.space.findUniqueOrThrow({
      where: { id },
      select: SELECT,
    });
    return toDto(space);
  }
}
