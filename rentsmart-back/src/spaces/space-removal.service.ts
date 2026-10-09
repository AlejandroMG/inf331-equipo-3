import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const HAS_BOOKINGS_MESSAGE =
  'Este espacio tiene reservas: desactívalo en vez de eliminarlo, así se conserva su historial';
export const BLOCKED_MESSAGE =
  'Un administrador bloqueó esta publicación: no puedes eliminarla';

/**
 * Eliminar un espacio propio (ES-08).
 *
 * Solo se elimina un espacio que nunca tuvo reservas: las reservas y sus pagos apuntan al espacio
 * y son el historial de ambas partes. Si tiene reservas, el camino es desactivarlo (ES-06).
 * Las fotos, el equipamiento, el horario y los favoritos se borran en cascada.
 */
@Injectable()
export class SpaceRemovalService {
  private readonly logger = new Logger(SpaceRemovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async remove(ownerId: string, id: string): Promise<void> {
    const space = await this.prisma.space.findUnique({
      where: { id },
      select: {
        ownerId: true,
        status: true,
        photos: { select: { storagePath: true } },
        _count: { select: { bookings: true } },
      },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo');
    }
    if (space.status === SpaceStatus.BLOCKED) {
      throw new ForbiddenException(BLOCKED_MESSAGE);
    }
    if (space._count.bookings > 0) {
      throw new ConflictException(HAS_BOOKINGS_MESSAGE);
    }

    try {
      await this.prisma.space.delete({ where: { id } });
    } catch (error) {
      // Una reserva creada entre la revisión y el borrado: la llave foránea lo impide.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(HAS_BOOKINGS_MESSAGE);
      }
      throw error;
    }

    for (const photo of space.photos) await this.discard(photo.storagePath);
  }

  /** Borra el archivo; si falla se anota y se sigue: una foto huérfana no debe romper la respuesta. */
  private async discard(path: string): Promise<void> {
    try {
      await this.storage.remove(path);
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${path}: ${String(error)}`);
    }
  }
}
