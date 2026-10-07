import { Injectable } from '@nestjs/common';
import { BookingStatus, SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  daysInMonth,
  hoursBetween,
  santiagoMonthOf,
  santiagoMonthRange,
  weekdayOf,
} from '../common/santiago-time';
import { OwnerMetricsDto } from './dto/owner-metrics.dto';

/** Las reservas que cuentan como ingreso: ya confirmadas o ya realizadas. */
const COUNTED = [BookingStatus.CONFIRMED, BookingStatus.FINISHED];

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Métricas del propietario (PN-04): los ingresos del mes y cuánto de su horario tuvo reservado cada espacio.
 * Solo lee las reservas; el mes se mide en la hora de Chile.
 */
@Injectable()
export class OwnerMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(ownerId: string, month?: string): Promise<OwnerMetricsDto> {
    const { year, month: monthNumber } = month
      ? { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }
      : santiagoMonthOf();
    const { start, end } = santiagoMonthRange(year, monthNumber);

    const [spaces, bookings] = await Promise.all([
      this.prisma.space.findMany({
        // Un borrador nunca recibió reservas: no es parte de las métricas.
        where: { ownerId, status: { not: SpaceStatus.DRAFT } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          status: true,
          rulesWeek: {
            select: { weekday: true, startTime: true, endTime: true },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          space: { ownerId },
          status: { in: COUNTED },
          startAt: { gte: start, lt: end },
        },
        select: { spaceId: true, startAt: true, endAt: true, subtotal: true },
      }),
    ]);

    const days = daysInMonth(year, monthNumber);
    const perSpace = spaces.map((space) => {
      // Las horas arrendables del mes: el horario de cada día de la semana, por cada vez que ese día cae en el mes.
      let availableHours = 0;
      for (let day = 1; day <= days; day++) {
        const weekday = weekdayOf(year, monthNumber, day);
        for (const rule of space.rulesWeek) {
          if (rule.weekday === weekday) {
            availableHours += hoursBetween(rule.startTime, rule.endTime);
          }
        }
      }
      const mine = bookings.filter((booking) => booking.spaceId === space.id);
      const bookedHours = mine.reduce(
        (sum, booking) =>
          sum + (booking.endAt.getTime() - booking.startAt.getTime()) / 3_600_000,
        0,
      );
      return {
        id: space.id,
        name: space.name,
        status: space.status,
        income: mine.reduce((sum, booking) => sum + booking.subtotal, 0),
        bookings: mine.length,
        bookedHours: round(bookedHours, 2),
        availableHours: round(availableHours, 2),
        occupancy:
          availableHours > 0
            ? round(Math.min(1, bookedHours / availableHours), 3)
            : null,
      };
    });

    return {
      month: `${year}-${String(monthNumber).padStart(2, '0')}`,
      income: perSpace.reduce((sum, space) => sum + space.income, 0),
      bookings: perSpace.reduce((sum, space) => sum + space.bookings, 0),
      spaces: perSpace,
    };
  }
}
