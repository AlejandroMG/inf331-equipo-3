import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MAX_PHOTO_BYTES } from '../spaces/dto/photo.dto';
import { detectImageType } from '../spaces/image-type';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MyProfileDto, PublicProfileDto } from './dto/profile.dto';

const MY_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  bio: true,
  profilePhotoUrl: true,
  role: true,
  isHost: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type StoredProfile = Prisma.UserGetPayload<{
  select: typeof MY_PROFILE_SELECT & { profilePhotoPath: true };
}>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string): Promise<MyProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: MY_PROFILE_SELECT,
    });
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar.');
    return user;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<MyProfileDto> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.bio !== undefined && { bio: dto.bio || null }),
      },
      select: MY_PROFILE_SELECT,
    });
  }

  async uploadPhoto(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<MyProfileDto> {
    if (!file) throw new BadRequestException('Falta la foto de perfil');
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('La foto no puede pesar más de 5 MB');
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException('Formato no válido: usa JPG, PNG o WebP');
    }

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoPath: true },
    });
    const stored = await this.storage.upload(
      `users/${userId}/${randomUUID()}.${type.extension}`,
      file.buffer,
      type.contentType,
    );
    let previousPath: string | null = null;
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          profilePhotoUrl: stored.url,
          profilePhotoPath: stored.path,
        },
        select: { ...MY_PROFILE_SELECT, profilePhotoPath: true },
      });
      previousPath = previous?.profilePhotoPath ?? null;
      if (previousPath) await this.discard(previousPath);
      return this.withoutStoragePath(updated);
    } catch (error) {
      await this.discard(stored.path);
      throw error;
    }
  }

  async removePhoto(userId: string): Promise<MyProfileDto> {
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoPath: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: null, profilePhotoPath: null },
      select: { ...MY_PROFILE_SELECT, profilePhotoPath: true },
    });
    if (previous?.profilePhotoPath)
      await this.discard(previous.profilePhotoPath);
    return this.withoutStoragePath(user);
  }

  async publicProfile(userId: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isHost: true, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        bio: true,
        profilePhotoUrl: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('El perfil público no existe');

    const reviewWhere = { space: { ownerId: userId } };
    const [summary, reviews] = await Promise.all([
      this.prisma.review.aggregate({
        where: reviewWhere,
        _count: { _all: true },
        _avg: { rating: true },
      }),
      this.prisma.review.findMany({
        where: reviewWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: { select: { name: true } },
          space: { select: { name: true } },
        },
      }),
    ]);

    return {
      ...user,
      reviewCount: summary._count._all,
      averageRating: summary._avg.rating,
      reviews: reviews.map((review) => ({
        id: review.id,
        authorName: review.author.name,
        spaceName: review.space.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })),
    };
  }

  private withoutStoragePath(user: StoredProfile): MyProfileDto {
    const { profilePhotoPath: _path, ...profile } = user;
    return profile;
  }

  private async discard(path: string): Promise<void> {
    try {
      await this.storage.remove(path);
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${path}: ${String(error)}`);
    }
  }
}
