import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MAX_PHOTO_BYTES, MAX_PHOTOS, PhotoDto } from './dto/photo.dto';
import { detectImageType } from './image-type';
import { IncompleteSpaceException } from './incomplete-space.exception';
import { SpacesService } from './spaces.service';

const PHOTO_VIEW = { id: true, url: true, position: true } as const;

/** Fotos de un espacio propio: subir, ordenar (la primera es la portada) y borrar (ES-03). */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly spaces: SpacesService,
  ) {}

  async add(
    ownerId: string,
    spaceId: string,
    file: Express.Multer.File | undefined,
  ): Promise<PhotoDto> {
    await this.spaces.ensureOwner(ownerId, spaceId);
    if (!file) throw new BadRequestException('Falta la foto');
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('La foto no puede pesar más de 5 MB');
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException('Formato no válido: usa JPG, PNG o WebP');
    }

    const stored = await this.storage.upload(
      `spaces/${spaceId}/${randomUUID()}.${type.extension}`,
      file.buffer,
      type.contentType,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Se bloquea el espacio para que dos subidas a la vez no pasen del máximo ni repitan posición.
        await tx.$queryRaw`SELECT id FROM "Space" WHERE id = ${spaceId} FOR UPDATE`;
        const count = await tx.spacePhoto.count({ where: { spaceId } });
        if (count >= MAX_PHOTOS) {
          throw new ConflictException(
            `Un espacio puede tener hasta ${MAX_PHOTOS} fotos`,
          );
        }
        return tx.spacePhoto.create({
          data: {
            spaceId,
            storagePath: stored.path,
            url: stored.url,
            position: count,
          },
          select: PHOTO_VIEW,
        });
      });
    } catch (error) {
      await this.discard(stored.path);
      throw error;
    }
  }

  async reorder(
    ownerId: string,
    spaceId: string,
    photoIds: string[],
  ): Promise<PhotoDto[]> {
    await this.spaces.ensureOwner(ownerId, spaceId);
    const current = await this.prisma.spacePhoto.findMany({
      where: { spaceId },
      select: { id: true },
    });
    const same =
      current.length === photoIds.length &&
      current.every((photo) => photoIds.includes(photo.id));
    if (!same) {
      throw new BadRequestException(
        'La lista debe tener exactamente las fotos del espacio, sin repetir',
      );
    }

    await this.prisma.$transaction(
      photoIds.map((id, position) =>
        this.prisma.spacePhoto.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(spaceId);
  }

  async remove(
    ownerId: string,
    spaceId: string,
    photoId: string,
  ): Promise<void> {
    await this.spaces.ensureOwner(ownerId, spaceId);
    const photo = await this.prisma.spacePhoto.findFirst({
      where: { id: photoId, spaceId },
      select: { id: true, position: true, storagePath: true },
    });
    if (!photo) throw new NotFoundException('La foto no existe');

    // Un espacio publicado no se puede quedar sin fotos.
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { status: true, _count: { select: { photos: true } } },
    });
    if (space?.status === SpaceStatus.ACTIVE && space._count.photos <= 1) {
      throw new IncompleteSpaceException(
        ['photos'],
        'Un espacio publicado necesita al menos una foto: desactívalo si quieres borrar la última',
      );
    }

    await this.prisma.$transaction([
      this.prisma.spacePhoto.delete({ where: { id: photo.id } }),
      // Las que venían después suben un lugar, para que las posiciones sigan siendo 0, 1, 2…
      this.prisma.spacePhoto.updateMany({
        where: { spaceId, position: { gt: photo.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
    await this.discard(photo.storagePath);
  }

  private list(spaceId: string): Promise<PhotoDto[]> {
    return this.prisma.spacePhoto.findMany({
      where: { spaceId },
      select: PHOTO_VIEW,
      orderBy: { position: 'asc' },
    });
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
