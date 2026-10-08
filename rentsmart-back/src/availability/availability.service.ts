import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { IncompleteSpaceException } from '../spaces/incomplete-space.exception';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { ReplaceScheduleDto, ScheduleDto } from './dto/schedule.dto';
import { scheduleError, sortRules } from './schedule-rules';

const RULE_VIEW = { weekday: true, startTime: true, endTime: true } as const;

/** Horario semanal de los espacios (DI-01). La disponibilidad responde 501 hasta que exista DI-02. */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  findAvailability(_spaceId: string, _query: AvailabilityQueryDto): Promise<AvailabilityDto> {
    throw new NotImplementedException('La disponibilidad todavía no está implementada (DI-02)');
  }

  /** El horario de un espacio propio, también de un borrador, por día y hora de inicio. */
  async findSchedule(userId: string, spaceId: string): Promise<ScheduleDto> {
    await this.loadOwned(userId, spaceId);
    const rules = await this.prisma.availabilityRule.findMany({
      where: { spaceId },
      select: RULE_VIEW,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return { rules };
  }

  /**
   * Reemplaza el horario completo. Las reservas que ya existen no se tocan: el horario solo decide qué se
   * puede reservar desde ahora. Un espacio publicado no puede quedar sin horario (ES-04, P-18): responde
   * el mismo 409 con `missing` que el resto de las reglas de publicación.
   */
  async replaceSchedule(userId: string, spaceId: string, dto: ReplaceScheduleDto): Promise<ScheduleDto> {
    const space = await this.loadOwned(userId, spaceId);
    const rules = sortRules(
      dto.rules.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
    );
    const invalid = scheduleError(rules);
    if (invalid) throw new BadRequestException(invalid);
    if (rules.length === 0 && space.status === SpaceStatus.ACTIVE) {
      throw new IncompleteSpaceException(
        ['schedule'],
        'Un espacio publicado no puede quedar sin horario: desactívalo primero',
      );
    }

    await this.prisma.$transaction([
      this.prisma.availabilityRule.deleteMany({ where: { spaceId } }),
      this.prisma.availabilityRule.createMany({
        data: rules.map((rule) => ({ ...rule, spaceId })),
      }),
    ]);
    return { rules };
  }

  /** Comprueba que el espacio exista y sea del usuario: 404 si no existe, 403 si es de otro. */
  private async loadOwned(userId: string, spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerId: true, status: true },
    });
    if (!space) throw new NotFoundException('El espacio no existe');
    if (space.ownerId !== userId) {
      throw new ForbiddenException('Este espacio no es tuyo');
    }
    return space;
  }
}
