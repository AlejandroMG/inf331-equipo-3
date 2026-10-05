import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceDto } from './dto/space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { IncompleteSpaceException } from './incomplete-space.exception';
import { missingFields } from './publish-rules';

const OWNER_VIEW = {
  id: true,
  status: true,
  name: true,
  typeId: true,
  description: true,
  capacity: true,
  pricePerHour: true,
  pricePerDay: true,
  regionId: true,
  communeId: true,
  address: true,
  addressDetail: true,
  rules: true,
  createdAt: true,
  updatedAt: true,
  amenities: { select: { amenityId: true }, orderBy: { amenityId: 'asc' } },
  photos: {
    select: { id: true, url: true, position: true },
    orderBy: { position: 'asc' },
  },
} as const;

type OwnerRow = {
  amenities: { amenityId: number }[];
} & Omit<SpaceDto, 'amenityIds'>;

function toDto(row: OwnerRow & { _count?: unknown }): SpaceDto {
  const { amenities, _count, ...space } = row;
  void _count; // los conteos son para decidir, no se devuelven
  return { ...space, amenityIds: amenities.map((a) => a.amenityId) };
}

/** Espacios del propietario: crear y editar el borrador mientras se publica (ES-02). */
@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateSpaceDto): Promise<SpaceDto> {
    const { amenityIds, ...fields } = dto;
    const regionId = await this.checkReferences(dto);
    const space = await this.prisma.space.create({
      data: {
        ...fields,
        ...(regionId !== undefined && { regionId }),
        ownerId,
        status: SpaceStatus.DRAFT,
        amenities: {
          create: (amenityIds ?? []).map((amenityId) => ({ amenityId })),
        },
      },
      select: OWNER_VIEW,
    });
    return toDto(space);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateSpaceDto,
  ): Promise<SpaceDto> {
    const current = await this.findOwned(ownerId, id);
    if (dto.name === null) throw new BadRequestException('El nombre es obligatorio');

    const { amenityIds, ...fields } = dto;
    const regionId = await this.checkReferences(dto);

    // Un espacio publicado no puede quedar sin algo de lo necesario para publicar (un cambio de precio sí vale).
    if (current.status === SpaceStatus.ACTIVE) {
      const missing = missingFields({
        typeId: dto.typeId !== undefined ? dto.typeId : current.typeId,
        description:
          dto.description !== undefined ? dto.description : current.description,
        capacity: dto.capacity !== undefined ? dto.capacity : current.capacity,
        communeId:
          dto.communeId !== undefined ? dto.communeId : current.communeId,
        pricePerHour:
          dto.pricePerHour !== undefined
            ? dto.pricePerHour
            : current.pricePerHour,
        pricePerDay:
          dto.pricePerDay !== undefined ? dto.pricePerDay : current.pricePerDay,
        photoCount: current._count.photos,
        scheduleCount: current._count.rulesWeek,
      });
      if (missing.length > 0) {
        throw new IncompleteSpaceException(
          missing,
          'Un espacio publicado debe seguir teniendo lo necesario para publicar: desactívalo si quieres dejarlo incompleto',
        );
      }
    }

    const space = await this.prisma.space.update({
      where: { id },
      data: {
        ...fields,
        ...(regionId !== undefined && { regionId }),
        // El equipamiento se reemplaza completo; si no viene, no se toca.
        ...(amenityIds !== undefined && {
          amenities: {
            deleteMany: {},
            create: amenityIds.map((amenityId) => ({ amenityId })),
          },
        }),
      },
      select: OWNER_VIEW,
    });
    return toDto(space);
  }

  async findOne(ownerId: string, id: string): Promise<SpaceDto> {
    return toDto(await this.findOwned(ownerId, id));
  }

  /** Comprueba que el espacio exista y sea del usuario: 404 si no existe, 403 si es de otro. */
  async ensureOwner(ownerId: string, id: string): Promise<void> {
    const space = await this.prisma.space.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo');
    }
  }

  /** Carga el espacio y comprueba que sea del usuario: 404 si no existe, 403 si es de otro. */
  private async findOwned(ownerId: string, id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      select: {
        ...OWNER_VIEW,
        ownerId: true,
        _count: { select: { photos: true, rulesWeek: true } },
      },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    if (space.ownerId !== ownerId) {
      throw new ForbiddenException('Este espacio no es tuyo');
    }
    const { ownerId: _owner, ...view } = space;
    return view;
  }

  /**
   * Comprueba que lo referenciado exista (tipo, región, comuna, equipamiento) y que la comuna sea
   * de la región. Devuelve la región que hay que guardar cuando solo se mandó la comuna.
   */
  private async checkReferences(
    dto: CreateSpaceDto | UpdateSpaceDto,
  ): Promise<number | undefined> {
    const { typeId, regionId, communeId, amenityIds } = dto;

    if (typeId != null) {
      const type = await this.prisma.spaceType.findUnique({
        where: { id: typeId },
        select: { id: true },
      });
      if (!type) throw new BadRequestException('El tipo de espacio no existe');
    }

    if (amenityIds !== undefined && amenityIds.length > 0) {
      const found = await this.prisma.amenity.count({
        where: { id: { in: amenityIds } },
      });
      if (found !== amenityIds.length) {
        throw new BadRequestException('Algún equipamiento no existe');
      }
    }

    if (communeId != null) {
      const commune = await this.prisma.commune.findUnique({
        where: { id: communeId },
        select: { regionId: true },
      });
      if (!commune) throw new BadRequestException('La comuna no existe');
      if (regionId != null && regionId !== commune.regionId) {
        throw new BadRequestException('La comuna no pertenece a la región');
      }
      return commune.regionId;
    }

    if (regionId != null) {
      const region = await this.prisma.region.findUnique({
        where: { id: regionId },
        select: { id: true },
      });
      if (!region) throw new BadRequestException('La región no existe');
    }
    return undefined;
  }
}
