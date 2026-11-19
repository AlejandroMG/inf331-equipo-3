import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { Prisma } from '../generated/prisma/client';
import { BookingStatus, SpaceStatus } from '../generated/prisma/enums';
import { RefundNotRecordedError } from '../payments/payment-refund.service';
import { PAYMENT_REFUNDER, type PaymentRefunder } from '../payments/payment-refunder';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateService } from './booking-state.service';
import { isOverlapViolation } from './overlap-error';
import { lockSpaceForBooking } from './space-booking-lock';

/** Motivos que quedan en el `BookingEvent` (con `actorId` nulo). Dicen la causa, sin datos personales. */
export const CONFIRMED_REASON = 'Sistema: validación automática aprobada';
export const SPACE_UNAVAILABLE_REASON = 'Sistema: el espacio ya no está disponible';
export const BOOKING_ENDED_REASON = 'Sistema: el horario de la reserva ya terminó';
export const SLOT_TAKEN_REASON = 'Sistema: otra reserva ocupa ese horario';

/** Va al log del reembolso. Es un texto fijo: `refundBooking` lo registra tal cual. */
const REFUND_REASON = 'Sistema: la reserva pagada no pasó la validación automática';

/**
 * Tiempo máximo de la transacción, incluida la espera del lock del espacio. Alcanza para esperar un
 * `BookingsService.create`, que lo retiene hasta 15 s porque llama a Stripe dentro de la suya (con los 5 s por defecto
 * de Prisma, ese solo caso la haría fallar). Una cola de varios `create` del mismo espacio puede pasarse: `confirm`
 * falla, la reserva sigue `PAID` y la resuelve el barrido.
 */
const CONFIRM_TX_TIMEOUT_MS = 20_000;

/** Qué hizo `confirm`: la reserva se resolvió en esta llamada, o no había nada que hacer. */
export type ConfirmationOutcome = 'confirmed' | 'cancelled' | 'skipped';

/** Lo que decidió la transacción. `refund` es lo que hay que devolver después del COMMIT, si es que hay un pago. */
type Decision = { outcome: ConfirmationOutcome; refund: number | null };

const NOTHING_TO_DO: Decision = { outcome: 'skipped', refund: null };

/**
 * Validación automática después del pago (RE-04, P-06). La llaman el webhook de Stripe (PA-02), cuando la reserva queda
 * `PAID` y en cada reenvío, y el barrido de las `PAID` atascadas (`BookingExpiryService.sweep`).
 *
 * Es idempotente y puede correr dos veces a la vez: el lock del espacio pone en fila las llamadas y la segunda, al
 * volver a leer, ve que la reserva ya no está `PAID` y sale. Por eso hay un solo `BookingEvent` y un solo pedido de
 * reembolso.
 *
 * Si la reserva pasa la validación queda `CONFIRMED`; si no, `CANCELLED` con el total devuelto. «Horario libre» es que
 * no se traslape con otra reserva: el horario semanal solo afecta a reservas nuevas (enmienda a P-06). Quien cancela aquí es
 * el único que puede reembolsar: el webhook no reembolsa una `CANCELLED` con un evento previo hacia `PAID` (enmienda a
 * P-06). Por eso un corte del proceso entre el COMMIT y el reembolso deja la reserva `CANCELLED` sin devolver, y ni el
 * reenvío del evento ni el barrido lo reparan: se recalcula a mano, como en PA-03.
 */
@Injectable()
export class BookingConfirmationService {
  private readonly logger = new Logger(BookingConfirmationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: BookingStateService,
    private readonly availability: AvailabilityService,
    @Inject(PAYMENT_REFUNDER) private readonly refunder: PaymentRefunder,
  ) {}

  /**
   * No hace nada si la reserva no existe o no está `PAID`. Un fallo inesperado (por ejemplo, de la base) se propaga con
   * la reserva todavía `PAID`. El webhook responde 200 igual, así que Stripe no reenvía solo: el reintento automático es
   * el barrido (ninguno con `BOOKING_SWEEP_ENABLED=false`), y también sirve un reenvío manual desde el dashboard de
   * Stripe. Un reembolso que falla no se propaga,
   * porque la reserva ya quedó `CANCELLED`: queda en el log para repararlo a mano.
   */
  async confirm(bookingId: string, now = new Date()): Promise<ConfirmationOutcome> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, spaceId: true },
    });
    if (booking?.status !== BookingStatus.PAID) return 'skipped';

    let decision: Decision;
    try {
      decision = await this.prisma.$transaction((tx) => this.validate(tx, bookingId, booking.spaceId, now), {
        timeout: CONFIRM_TX_TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        // Otro cambio ganó y la transacción se deshizo: la reserva queda como la dejó ese cambio.
        this.logger.warn(`Reserva ${bookingId} no se resolvió, otro cambio llegó primero`);
        return 'skipped';
      }
      if (isOverlapViolation(error)) {
        // No debería ocurrir: la fila `PAID` ya cumple la restricción. Se deshizo y sigue `PAID`; el barrido la reintenta.
        this.logger.error(`Reserva ${bookingId} rechazada por booking_no_overlap al validarla: sigue PAID`);
        return 'skipped';
      }
      throw error;
    }

    if (decision.refund !== null) await this.refund(bookingId, decision.refund);
    return decision.outcome;
  }

  private async validate(
    tx: Prisma.TransactionClient,
    bookingId: string,
    spaceId: string,
    now: Date,
  ): Promise<Decision> {
    await lockSpaceForBooking(tx, spaceId);
    // Con el lock tomado: otra llamada pudo resolverla mientras esta esperaba.
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, startAt: true, endAt: true, unit: true, payment: { select: { amount: true } } },
    });
    if (booking?.status !== BookingStatus.PAID) return NOTHING_TO_DO;

    const failure = await this.failureReason(tx, bookingId, spaceId, booking, now);
    if (failure) {
      await this.state.transition(bookingId, BookingStatus.CANCELLED, { actorId: null, reason: failure }, tx);
      return { outcome: 'cancelled', refund: booking.payment?.amount ?? null };
    }
    await this.state.transition(bookingId, BookingStatus.CONFIRMED, { actorId: null, reason: CONFIRMED_REASON }, tx);
    return { outcome: 'confirmed', refund: null };
  }

  /** Por qué no se puede confirmar, o nulo si se puede. */
  private async failureReason(
    tx: Prisma.TransactionClient,
    bookingId: string,
    spaceId: string,
    { startAt, endAt }: { startAt: Date; endAt: Date },
    now: Date,
  ): Promise<string | null> {
    const space = await tx.space.findUnique({ where: { id: spaceId }, select: { status: true } });
    if (space?.status !== SpaceStatus.ACTIVE) return SPACE_UNAVAILABLE_REASON;
    // El rango es [startAt, endAt): justo en endAt ya terminó.
    if (endAt <= now) return BOOKING_ENDED_REASON;
    // `excludeBookingId`: la propia `PAID` ocupa su horario.
    const taken = await this.availability.hasOverlap(spaceId, startAt, endAt, { tx, now, excludeBookingId: bookingId });
    return taken ? SLOT_TAKEN_REASON : null;
  }

  /** Fuera de la transacción: no retiene una conexión ni el lock mientras responde el proveedor. */
  private async refund(bookingId: string, amount: number): Promise<void> {
    try {
      await this.refunder.refundBooking(bookingId, amount, REFUND_REASON);
    } catch (error) {
      // El dinero ya se devolvió: PaymentRefundService dejó en el log cómo repararlo, y aquí no es un reembolso fallido.
      if (error instanceof RefundNotRecordedError) {
        this.logger.error(`Reserva ${bookingId} cancelada: Stripe devolvió ${amount} CLP y falta registrarlo en la base`);
        return;
      }
      // Solo el nombre: el mensaje de un error del proveedor puede traer datos del pago.
      const name = error instanceof Error ? error.name : 'error';
      this.logger.error(`Reserva ${bookingId} cancelada, pero falló el reembolso de ${amount} CLP: ${name}`);
    }
  }
}
