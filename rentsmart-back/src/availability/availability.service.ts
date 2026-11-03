import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { santiagoStartOfDay, TIME_ZONE } from '../common/santiago-time';
import { Prisma } from '../generated/prisma/client';
import { BookingUnit, SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { IncompleteSpaceException } from '../spaces/incomplete-space.exception';
import {
  availabilityOfDay,
  BusyInterval,
  CalendarDate,
  daysBetween,
  HOLDING_STATUSES,
  isBookableRange,
  isHolding,
  isRangeAvailable,
  parseDate,
} from './availability-slots';
import { AvailabilityQueryDto, MAX_AVAILABILITY_DAYS } from './dto/availability-query.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { ReplaceScheduleDto, ScheduleDto } from './dto/schedule.dto';
import { scheduleError, sortRules, WeeklyRule } from './schedule-rules';

const RULE_VIEW = { weekday: true, startTime: true, endTime: true } as const;

/** Quien lee: el cliente de siempre o el de una transacción abierta (RE-02, RE-04). */
type Db = Prisma.TransactionClient;

/** Opciones de `isAvailable`. Todas son opcionales; sin ninguna, revisa por hora con el reloj actual. */
export interface AvailabilityOptions {
  /** Lee dentro de la transacción de quien llama y ve lo que ya escribió. */
  tx?: Prisma.TransactionClient;
  /** La hora actual; solo para los tests. */
  now?: Date;
  /** `HOUR` (por defecto) o `DAY`: con `DAY` el rango debe ser exactamente el `fullDay` de ese día de Chile. */
  unit?: BookingUnit;
  /** Ignora esa reserva al buscar traslapes: RE-04 valida una `PAID` que ocupa su propio horario. */
  excludeBookingId?: string;
  /** Acepta un rango que ya empezó y no ha terminado: RE-04 confirma un pago que llegó a las 10:02 por el bloque de 10:00. */
  allowStarted?: boolean;
}

/** Horario semanal de los espacios (DI-01) y bloques libres para reservar (DI-02). */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Por cada día pedido (hora de Chile), los bloques libres de una hora y el día completo. Responde 400 si una fecha
   * no existe, si `from` es posterior a `to` o si se piden más de 31 días, y 404 si el espacio no existe o no está
   * activo. `now` es la hora actual; se recibe para poder probar con un reloj fijo.
   */
  async findAvailability(spaceId: string, query: AvailabilityQueryDto, now = new Date()): Promise<AvailabilityDto> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    if (!from || !to) throw new BadRequestException('from y to deben ser fechas que existan');
    const count = daysBetween(from, to);
    if (count < 1) throw new BadRequestException('from no puede ser posterior a to');
    if (count > MAX_AVAILABILITY_DAYS) {
      throw new BadRequestException(`Se pueden pedir hasta ${MAX_AVAILABILITY_DAYS} días de una vez`);
    }

    if (!(await this.isActive(this.prisma, spaceId))) {
      throw new NotFoundException('El espacio no existe o no está publicado');
    }
    const start = santiagoStartOfDay(from.year, from.month, from.day);
    const end = santiagoStartOfDay(to.year, to.month, to.day + 1);
    const { rules, busy } = await this.loadRange(this.prisma, spaceId, start, end, now);

    const dates: CalendarDate[] = Array.from({ length: count }, (_, i) => ({ ...from, day: from.day + i }));
    return { spaceId, timeZone: TIME_ZONE, days: dates.map((date) => availabilityOfDay(rules, date, busy, now)) };
  }

  /**
   * Si se puede reservar [startAt, endAt) en el espacio: está `ACTIVE`, el rango no ha empezado, cabe en el horario
   * semanal (por hora o, con `unit: 'DAY'`, como el `fullDay` de ese día) y no lo traslapa una reserva `PENDING`
   * vigente, `PAID` o `CONFIRMED`. Nunca lanza. Con `tx` lee dentro de la transacción de quien llama (RE-02 al crear
   * la reserva, RE-04 al confirmarla). La restricción `booking_no_overlap` sigue siendo la que impide dos reservas a
   * la vez.
   */
  async isAvailable(
    spaceId: string,
    startAt: Date,
    endAt: Date,
    { tx, now = new Date(), unit, excludeBookingId, allowStarted }: AvailabilityOptions = {},
  ): Promise<boolean> {
    // Un rango que no vale o que ya empezó se descarta sin ir a la base.
    if (!isBookableRange(startAt, endAt, now, allowStarted)) return false;
    const db = tx ?? this.prisma;
    if (!(await this.isActive(db, spaceId))) return false;
    const { rules, busy } = await this.loadRange(db, spaceId, startAt, endAt, now, excludeBookingId);
    return isRangeAvailable(rules, startAt, endAt, busy, now, { unit, allowStarted });
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

  private async isActive(db: Db, spaceId: string): Promise<boolean> {
    const space = await db.space.findUnique({ where: { id: spaceId }, select: { status: true } });
    return space?.status === SpaceStatus.ACTIVE;
  }

  /**
   * El horario semanal y lo que está ocupado en [start, end), con una consulta cada uno: las reservas que se cruzan
   * con el rango, en los estados que retienen el horario. Una `PENDING` vencida y la reserva `excludeBookingId` se
   * descartan después, en código.
   */
  private async loadRange(
    db: Db,
    spaceId: string,
    start: Date,
    end: Date,
    now: Date,
    excludeBookingId?: string,
  ): Promise<{ rules: WeeklyRule[]; busy: BusyInterval[] }> {
    const rules = await db.availabilityRule.findMany({ where: { spaceId }, select: RULE_VIEW });
    const bookings = await db.booking.findMany({
      where: { spaceId, status: { in: HOLDING_STATUSES }, startAt: { lt: end }, endAt: { gt: start } },
      select: { id: true, startAt: true, endAt: true, status: true, expiresAt: true },
    });
    // DI-03 (#37): los bloqueos del propietario se sumarían aquí, como intervalos ocupados, con una consulta más
    // del mismo rango. Todavía no tienen modelo.
    const busy = bookings.filter(
      (booking) => (excludeBookingId === undefined || booking.id !== excludeBookingId) && isHolding(booking, now),
    );
    return { rules, busy };
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
