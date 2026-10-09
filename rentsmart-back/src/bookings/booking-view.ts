import { BookingStatus, Prisma } from '../generated/prisma/client';
import { BookingDto } from './dto/booking.dto';

/** Lo que hay que cargar de una reserva para armar su `BookingDto`. */
export const BOOKING_VIEW = {
  space: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      address: true,
      addressDetail: true,
      commune: { select: { name: true } },
      photos: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithSpace = Prisma.BookingGetPayload<{ include: typeof BOOKING_VIEW }>;

/** La reserva como la devuelve la API. El detalle privado de la dirección solo sale en `CONFIRMED` (P-09). */
export function toBookingDto(booking: BookingWithSpace): BookingDto {
  const { space } = booking;
  return {
    id: booking.id,
    status: booking.status,
    unit: booking.unit,
    startAt: booking.startAt,
    endAt: booking.endAt,
    subtotal: booking.subtotal,
    fee: booking.fee,
    total: booking.total,
    expiresAt: booking.expiresAt,
    createdAt: booking.createdAt,
    space: {
      id: space.id,
      name: space.name,
      communeName: space.commune?.name ?? null,
      address: space.address,
      addressDetail: booking.status === BookingStatus.CONFIRMED ? space.addressDetail : null,
      coverUrl: space.photos[0]?.url ?? null,
    },
  };
}
