import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { detectImageType } from '../spaces/image-type';
import { SpaceDescriptionAiService } from './space-description-ai.service';

const MAX_AI_PHOTO_BYTES = 15 * 1024 * 1024;

@Injectable()
export class GenerateSpaceDescriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: SpaceDescriptionAiService,
  ) {}

  async generate(ownerId: string, spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: {
        ownerId: true,
        status: true,
        name: true,
        capacity: true,
        address: true,
        pricePerHour: true,
        pricePerDay: true,
        rules: true,
        type: { select: { name: true } },
        commune: { select: { name: true } },
        region: { select: { name: true } },
        amenities: { select: { amenity: { select: { name: true } } } },
        rulesWeek: {
          select: { weekday: true, startTime: true, endTime: true },
          orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
        },
        photos: {
          select: { storagePath: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!space) throw new NotFoundException('El espacio no existe.');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo.');
    }
    if (space.status !== SpaceStatus.DRAFT) {
      throw new BadRequestException(
        'La descripción con IA solo se puede generar para un borrador.',
      );
    }
    if (space.photos.length === 0) {
      throw new BadRequestException(
        'Agrega al menos una foto antes de generar la descripción.',
      );
    }

    const photos = await Promise.all(
      space.photos.map(async ({ storagePath }) => {
        const data = await this.storage.read(storagePath);
        const type = detectImageType(data);
        if (!type) {
          throw new BadRequestException(
            'Una foto del espacio tiene un formato que la IA no admite.',
          );
        }
        return { data, mimeType: type.contentType };
      }),
    );
    const totalBytes = photos.reduce(
      (sum, photo) => sum + photo.data.length,
      0,
    );
    if (totalBytes > MAX_AI_PHOTO_BYTES) {
      throw new PayloadTooLargeException(
        'Las fotos superan el límite conjunto de 15 MB para generar con IA.',
      );
    }

    const result = await this.ai.generate(ownerId, spaceId, {
      name: space.name,
      type: space.type?.name,
      region: space.region?.name,
      commune: space.commune?.name,
      address: space.address ?? undefined,
      capacity: space.capacity ?? undefined,
      amenities: space.amenities.map(({ amenity }) => amenity.name),
      rules: space.rules ?? undefined,
      pricePerHour: space.pricePerHour ?? undefined,
      pricePerDay: space.pricePerDay ?? undefined,
      schedule: space.rulesWeek,
      photos,
    });
    await this.prisma.space.update({
      where: { id: spaceId },
      data: { description: result.description },
    });
    return result;
  }

  async markReviewed(ownerId: string, spaceId: string): Promise<void> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true, status: true },
    });
    if (!space) throw new NotFoundException('El espacio no existe.');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo.');
    }
    if (
      space.status !== SpaceStatus.DRAFT &&
      space.status !== SpaceStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'La descripción solo se puede revisar antes de publicar o reactivar.',
      );
    }

    const result = await this.prisma.aiSpaceGeneration.updateMany({
      where: { spaceId, userId: ownerId, description: { not: null } },
      data: { reviewedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new BadRequestException(
        'Primero genera una descripción con IA para este espacio.',
      );
    }
  }
}
