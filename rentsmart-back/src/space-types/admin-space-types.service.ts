import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSpaceTypeDto } from './dto/admin-space-type.dto';

const MAX_ID = 2_147_483_647;

/** Para comparar nombres: sin tildes ni mayúsculas ("Cancha" y "cáncha" son lo mismo). */
export const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Palabras de un alojamiento, que no se arrienda aquí (P-08). Es una guarda contra el error evidente, no una
 * lista completa: el administrador es quien decide qué tipos se agregan.
 */
const LODGING_WORDS = new Set([
  'alojamiento',
  'hospedaje',
  'hostal',
  'hostel',
  'hotel',
  'motel',
  'cabana',
  'cabanas',
  'departamento',
  'habitacion',
  'dormitorio',
  'airbnb',
]);

const SELECT = {
  id: true,
  name: true,
  _count: { select: { spaces: true } },
} as const;

const toDto = (type: {
  id: number;
  name: string;
  _count: { spaces: number };
}): AdminSpaceTypeDto => ({
  id: type.id,
  name: type.name,
  spaces: type._count.spaces,
});

/** Los tipos de espacio que administra el admin (AD-02): ver, crear y renombrar. No se borran: hay espacios que los usan. */
@Injectable()
export class AdminSpaceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminSpaceTypeDto[]> {
    const types = await this.prisma.spaceType.findMany({
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return types.map(toDto);
  }

  async create(name: string): Promise<AdminSpaceTypeDto> {
    await this.check(name);
    const type = await this.prisma.spaceType.create({
      data: { name },
      select: SELECT,
    });
    return toDto(type);
  }

  async rename(id: number, name: string): Promise<AdminSpaceTypeDto> {
    // Los ids son Int de Postgres: uno fuera de rango no existe (y sin esto la consulta fallaría con un 500).
    if (id < 1 || id > MAX_ID) throw new NotFoundException('El tipo de espacio no existe');
    const existing = await this.prisma.spaceType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('El tipo de espacio no existe');
    await this.check(name, id);
    const type = await this.prisma.spaceType.update({
      where: { id },
      data: { name },
      select: SELECT,
    });
    return toDto(type);
  }

  /** Rechaza un alojamiento (400) y un nombre que ya tiene otro tipo (409). `selfId` es el tipo que se renombra. */
  private async check(name: string, selfId?: number): Promise<void> {
    const words = normalizeName(name).split(/[^a-z0-9]+/);
    if (words.some((word) => LODGING_WORDS.has(word))) {
      throw new BadRequestException(
        'No se permiten tipos de alojamiento: aquí se arriendan espacios por hora o por día',
      );
    }
    const wanted = normalizeName(name);
    const all = await this.prisma.spaceType.findMany({
      select: { id: true, name: true },
    });
    if (all.some((type) => type.id !== selfId && normalizeName(type.name) === wanted)) {
      throw new ConflictException('Ya existe un tipo de espacio con ese nombre');
    }
  }
}
