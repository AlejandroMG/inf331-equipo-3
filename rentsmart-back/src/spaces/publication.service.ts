import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { SpaceDto } from './dto/space.dto';
import { IncompleteSpaceException } from './incomplete-space.exception';
import { missingFields } from './publish-rules';
import { SpacesService } from './spaces.service';

/** Lo que se necesita de un espacio para decidir si se puede publicar. */
interface LoadedSpace {
  status: SpaceStatus;
  typeId: number | null;
  description: string | null;
  capacity: number | null;
  communeId: number | null;
  pricePerHour: number | null;
  pricePerDay: number | null;
  _count: { photos: number; rulesWeek: number };
}

const BLOCKED_MESSAGE =
  'Un administrador bloqueó esta publicación: no puedes cambiar su estado';

/** Publicar un borrador y activar o desactivar un espacio (ES-04 y ES-06). */
@Injectable()
export class PublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
  ) {}

  /** Publica un borrador si tiene todo lo necesario; si no, 409 con lo que falta. */
  async publish(ownerId: string, id: string): Promise<SpaceDto> {
    const space = await this.load(ownerId, id);
    if (space.status === SpaceStatus.BLOCKED) {
      throw new ForbiddenException(BLOCKED_MESSAGE);
    }
    if (space.status === SpaceStatus.ACTIVE) {
      throw new ConflictException('El espacio ya está publicado');
    }
    if (space.status === SpaceStatus.INACTIVE) {
      throw new ConflictException(
        'El espacio está desactivado: actívalo para publicarlo de nuevo',
      );
    }
    this.assertComplete(space);

    await this.move(ownerId, id, SpaceStatus.DRAFT, SpaceStatus.ACTIVE);
    return this.spaces.findOne(ownerId, id);
  }

  /**
   * Activa o desactiva un espacio ya publicado. Pedir el estado que ya tiene no cambia nada (así un doble
   * clic no da error). Un borrador no se activa por aquí: se publica. Para activar hay que seguir cumpliendo
   * lo necesario para publicar, porque el espacio pudo editarse mientras estaba desactivado.
   */
  async changeStatus(
    ownerId: string,
    id: string,
    target: SpaceStatus,
  ): Promise<SpaceDto> {
    const space = await this.load(ownerId, id);
    if (space.status === SpaceStatus.BLOCKED) {
      throw new ForbiddenException(BLOCKED_MESSAGE);
    }
    if (space.status === target) return this.spaces.findOne(ownerId, id);
    if (space.status === SpaceStatus.DRAFT) {
      throw new ConflictException(
        'Un borrador no se activa ni se desactiva: publícalo primero',
      );
    }

    if (target === SpaceStatus.ACTIVE) this.assertComplete(space);
    await this.move(ownerId, id, space.status, target);
    return this.spaces.findOne(ownerId, id);
  }

  private assertComplete(space: LoadedSpace) {
    const missing = missingFields({
      ...space,
      photoCount: space._count.photos,
      scheduleCount: space._count.rulesWeek,
    });
    if (missing.length > 0) throw new IncompleteSpaceException(missing);
  }

  /** Cambia el estado solo si sigue siendo `from`: así dos peticiones a la vez no se pisan. */
  private async move(
    ownerId: string,
    id: string,
    from: SpaceStatus,
    to: SpaceStatus,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.space.updateMany({
        where: { id, status: from },
        data: { status: to },
      });
      if (count === 0) {
        throw new ConflictException(
          'El estado del espacio cambió: recarga e inténtalo de nuevo',
        );
      }
      // Publicar habilita a la cuenta como propietaria (P-02).
      if (to === SpaceStatus.ACTIVE) {
        await tx.user.update({
          where: { id: ownerId },
          data: { isHost: true },
        });
      }
    });
  }

  private async load(ownerId: string, id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      select: {
        ownerId: true,
        status: true,
        typeId: true,
        description: true,
        capacity: true,
        communeId: true,
        pricePerHour: true,
        pricePerDay: true,
        _count: { select: { photos: true, rulesWeek: true } },
      },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo');
    }
    return space;
  }
}
