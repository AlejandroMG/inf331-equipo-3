import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { BookingStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateService } from './booking-state.service';
import { BOOKING_VIEW, toBookingDto } from './booking-view';
import { cancellationRefund, CancelledBy } from './cancellation-policy';
import { BookingCheckoutDto, BookingDto, BookingsPageDto } from './dto/booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PageQueryDto } from './dto/page-query.dto';

/** Desde qué estados cancela una persona (RE-05). `PAID` dura un instante y lo resuelve la validación automática. */
const CANCELLABLE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

/**
 * Reservas del arrendatario. Reservar y consultar responden 501 hasta que exista su historia (RE-02, PA-01);
 * cancelar ya está implementado (RE-05).
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: BookingStateService,
  ) {}

  create(_userId: string, _dto: CreateBookingDto): Promise<BookingCheckoutDto> {
    throw new NotImplementedException('Reservar todavía no está implementado (RE-02)');
  }

  findMine(_userId: string, _query: PageQueryDto): Promise<BookingsPageDto> {
    throw new NotImplementedException('Mis reservas todavía no está implementado (RE-02)');
  }

  findOne(_userId: string, _id: string): Promise<BookingDto> {
    throw new NotImplementedException('Ver una reserva todavía no está implementado (RE-02)');
  }

  /**
   * Cancela una reserva `PENDING` o `CONFIRMED`. Puede hacerlo su arrendatario o el dueño del espacio, con un
   * motivo que queda en el historial. El monto a reembolsar lo decide `cancellationRefund` (P-14).
   */
  async cancel(userId: string, id: string, dto: CancelBookingDto): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_VIEW });
    if (!booking) throw new NotFoundException('La reserva no existe');
    const cancelledBy = roleOf(userId, booking.renterId, booking.space.ownerId);
    if (!cancelledBy) throw new ForbiddenException('Esta reserva no es tuya ni de un espacio tuyo');

    const now = new Date();
    if (booking.status === BookingStatus.PENDING && booking.expiresAt && booking.expiresAt <= now) {
      // Ya venció el plazo de pago: se deja como vencida, en su propia transacción, y no hay nada que cancelar.
      await this.state.transition(id, BookingStatus.EXPIRED, { actorId: null, reason: 'Venció el plazo de pago' });
      throw new ConflictException('La reserva venció sin pagarse; ya no se puede cancelar');
    }
    if (!CANCELLABLE.includes(booking.status)) {
      throw new ConflictException(`Una reserva en estado ${booking.status} no se puede cancelar`);
    }

    const refund = cancellationRefund(booking, cancelledBy, now);
    await this.prisma.$transaction(async (tx) => {
      // Bloquea la fila en el estado que se revisó: si en el intertanto llegó el pago u otro cambio, no cancela.
      const locked = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: { status: booking.status },
      });
      if (locked.count === 0) {
        throw new ConflictException('La reserva cambió de estado mientras se procesaba; vuelve a intentarlo');
      }
      await this.state.transition(id, BookingStatus.CANCELLED, { actorId: userId, reason: dto.reason }, tx);
    });

    // PA-03 (#47): aquí va el reembolso en Stripe por `refund` CLP, que además debe actualizar
    // `Payment.refundedAmount` y `Payment.status`. Todavía no existe; por ahora solo queda en el registro.
    if (refund > 0) {
      this.logger.warn(`Reserva ${id} cancelada: reembolso de ${refund} CLP pendiente (PA-03)`);
    }

    return toBookingDto({ ...booking, status: BookingStatus.CANCELLED });
  }
}

function roleOf(userId: string, renterId: string, ownerId: string): CancelledBy | null {
  if (userId === renterId) return 'RENTER';
  if (userId === ownerId) return 'OWNER';
  return null;
}
