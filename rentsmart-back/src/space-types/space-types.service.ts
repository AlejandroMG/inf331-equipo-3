import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReferenceItemDto } from './dto/reference-item.dto';

const SELECT_ITEM = { id: true, name: true } as const;

/** Listas de referencia de solo lectura que alimentan los formularios y filtros (ES-01). */
@Injectable()
export class SpaceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findSpaceTypes(): Promise<ReferenceItemDto[]> {
    return this.prisma.spaceType.findMany({
      select: SELECT_ITEM,
      orderBy: { id: 'asc' },
    });
  }

  findAmenities(): Promise<ReferenceItemDto[]> {
    return this.prisma.amenity.findMany({
      select: SELECT_ITEM,
      orderBy: { name: 'asc' },
    });
  }

  findRegions(): Promise<ReferenceItemDto[]> {
    return this.prisma.region.findMany({
      select: SELECT_ITEM,
      orderBy: { name: 'asc' },
    });
  }

  async findCommunes(regionId: number): Promise<ReferenceItemDto[]> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
      select: {
        communes: { select: SELECT_ITEM, orderBy: { name: 'asc' } },
      },
    });
    if (!region) throw new NotFoundException('La región no existe');
    return region.communes;
  }
}
