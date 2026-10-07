import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { BookingStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { santiagoStartOfDay } from '../common/santiago-time';
import { ListOwnerBookingsQueryDto } from './dto/list-owner-bookings-query.dto';
import { OwnerBookingsPageDto } from './dto/owner-booking.dto';

/** Que `AAAA-MM-DD` sea un día que existe: el patrón deja pasar un 31 de febrero. */
function isRealDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/** Un día `AAAA-MM-DD` como el instante en que empieza en Chile. */
function startOfDay(date: string, plusDays = 0): Date {
  const [year, month, day] = date.split('-').map(Number);
  return santiagoStartOfDay(year, month, day + plusDays);
}

/**
 * Reservas de los espacios del propietario (PN-02). Solo lee: crear y cambiar de estado una reserva es del módulo
 * de reservas. El contacto del arrendatario solo sale en las confirmadas.
 */
@Injectable()
export class OwnerBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ownerId: string,
    { page, pageSize, status, from, to, sort }: ListOwnerBookingsQueryDto,
  ): Promise<OwnerBookingsPageDto> {
    for (const [name, date] of [['from', from], ['to', to]] as const) {
      if (date !== undefined && !isRealDate(date)) {
        throw new BadRequestException(`${name} no es una fecha que exista`);
      }
    }
    if (from !== undefined && to !== undefined && from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }
    // `to` incluye su día completo: hasta el comienzo del día siguiente.
    const startAt: Prisma.DateTimeFilter | undefined =
      from !== undefined || to !== undefined
        ? {
            ...(from !== undefined && { gte: startOfDay(from) }),
            ...(to !== undefined && { lt: startOfDay(to, 1) }),
          }
        : undefined;
    const where: Prisma.BookingWhereInput = {
      space: { ownerId },
      ...(status !== undefined && { status }),
      ...(startAt && { startAt }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ startAt: sort }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          startAt: true,
          endAt: true,
          unit: true,
          subtotal: true,
          status: true,
          space: { select: { id: true, name: true } },
          renter: { select: { name: true, email: true, phone: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: rows.map((booking) => ({
        id: booking.id,
        spaceId: booking.space.id,
        spaceName: booking.space.name,
        renterName: booking.renter.name,
        startAt: booking.startAt,
        endAt: booking.endAt,
        unit: booking.unit,
        subtotal: booking.subtotal,
        status: booking.status,
        contact:
          booking.status === BookingStatus.CONFIRMED
            ? { email: booking.renter.email, phone: booking.renter.phone }
            : null,
      })),
      total,
      page,
      pageSize,
    };
  }
}
