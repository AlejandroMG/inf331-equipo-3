import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Booking, BookingEvent, BookingStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from './booking-transitions';

/** Quién hace el cambio y por qué. `actorId` es nulo cuando lo hace el sistema (webhook, tarea programada). */
export interface BookingChange {
  actorId: string | null;
  reason?: string | null;
}

/**
 * Máquina de estados de la reserva (RE-01). Todo cambio de `Booking.status` pasa por `transition`,
 * que valida la transición y deja el `BookingEvent` en la misma transacción.
 */
@Injectable()
export class BookingStateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pasa la reserva a `to` y registra el evento. Responde 404 si la reserva no existe y 409 si la transición no es válida
   * o si otro cambio simultáneo ganó. Con `tx` trabaja dentro de la transacción de quien llama; sin `tx` abre la suya.
   */
  async transition(
    bookingId: string,
    to: BookingStatus,
    change: BookingChange,
    tx?: Prisma.TransactionClient,
  ): Promise<Booking> {
    if (!tx) {
      return this.prisma.$transaction((client) => this.transition(bookingId, to, change, client));
    }

    const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    if (!current) {
      throw new NotFoundException('La reserva no existe');
    }
    const from = current.status;
    if (!canTransition(from, to)) {
      throw new ConflictException(`Una reserva en estado ${from} no puede pasar a ${to}`);
    }

    // Condicionado al estado de origen: si otro cambio llegó primero, no actualiza ninguna fila.
    const [booking] = await tx.booking.updateManyAndReturn({
      where: { id: bookingId, status: from },
      data: { status: to },
    });
    if (!booking) {
      throw new ConflictException('La reserva cambió de estado mientras se procesaba; vuelve a intentarlo');
    }

    await tx.bookingEvent.create({
      data: { bookingId, fromStatus: from, toStatus: to, actorId: change.actorId, reason: change.reason ?? null },
    });
    return booking;
  }

  /** Evento inicial, de nulo a `PENDING`. Lo llama RE-02 en la misma transacción en que crea la reserva. */
  recordCreation(bookingId: string, change: BookingChange, tx?: Prisma.TransactionClient): Promise<BookingEvent> {
    return (tx ?? this.prisma).bookingEvent.create({
      data: {
        bookingId,
        fromStatus: null,
        toStatus: BookingStatus.PENDING,
        actorId: change.actorId,
        reason: change.reason ?? null,
      },
    });
  }
}
