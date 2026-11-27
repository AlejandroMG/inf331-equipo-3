import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { BookingConfirmationService } from '../bookings/booking-confirmation.service';
import { EXPIRED_REASON } from '../bookings/booking-expiry.service';
import { BookingStateService } from '../bookings/booking-state.service';
import { PageQueryDto } from '../bookings/dto/page-query.dto';
import { BookingStatus, PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsPageDto, WebhookAckDto } from './dto/payment.dto';
import { PAYMENT_REFUNDER, type PaymentRefunder } from './payment-refunder';
import { STRIPE_CLIENT } from './stripe.module';

/** Motivo que queda en el `BookingEvent` cuando el webhook recibe el pago (con `actorId` nulo). */
export const PAID_REASON = 'Sistema: Stripe confirmó el pago';

/** Lo único que este servicio usa del cliente de Stripe; así los tests le pasan un doble pequeño. */
type StripeWebhooksClient = Pick<Stripe, 'webhooks'>;

/** El pago de una sesión de Stripe y el estado de su reserva. */
interface SessionPayment {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  booking: { status: BookingStatus };
}

/**
 * Pagos del arrendatario: `findMine` (PA-01) y el webhook de Stripe (PA-02).
 *
 * Un `Payment` nace `PENDING` junto con la reserva, cuando el checkout es Stripe (`BookingsService.create`). Con el
 * checkout provisorio (sin `STRIPE_SECRET_KEY`) no hay sesión de Stripe y la reserva queda sin `Payment`.
 *
 * El webhook es idempotente por el estado, sin tabla de eventos procesados: cada rama mira el estado de la reserva y
 * del pago, así que un evento repetido no vuelve a cambiar nada. Un error no 2xx hace que Stripe reintente.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeWebhooksClient | null,
    private readonly state: BookingStateService,
    private readonly confirmation: BookingConfirmationService,
    @Inject(PAYMENT_REFUNDER) private readonly refunder: PaymentRefunder,
  ) {}

  /** `rawBody` es el cuerpo tal como llegó: Stripe firma esos bytes, no el JSON ya interpretado. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string): Promise<WebhookAckDto> {
    const event = this.verifiedEvent(rawBody, signature);
    if (event.type === 'checkout.session.completed') {
      await this.onSessionCompleted(event.data.object);
    } else if (event.type === 'checkout.session.expired') {
      await this.onSessionExpired(event.data.object.id);
    }
    return { received: true };
  }

  /** 503 si no está configurado y 400 si la firma no corresponde. El log no guarda el cuerpo ni la firma. */
  private verifiedEvent(rawBody: Buffer | undefined, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !secret) {
      throw new ServiceUnavailableException('El webhook de pagos no está configurado');
    }
    if (!rawBody) throw new BadRequestException('Falta el cuerpo del evento');
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      this.logger.warn('Webhook de Stripe rechazado: la firma no corresponde al cuerpo');
      throw new BadRequestException('La firma de Stripe no es válida');
    }
  }

  // La sesión, no sus metadatos, decide sobre qué reserva se actúa.
  private findSessionPayment(sessionId: string): Promise<SessionPayment | null> {
    return this.prisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true, bookingId: true, amount: true, status: true, booking: { select: { status: true } } },
    });
  }

  private async onSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const intentId = paymentIntentId(session);
    // Defensa: el checkout fija tarjeta (`StripeCheckoutGateway`), así que esto no debería ocurrir. El id de la reserva
    // que trae la sesión solo va al log, para investigarlo.
    if (session.payment_status !== 'paid') {
      this.logger.error(
        `Sesión ${session.id} completada sin pago (${session.payment_status}), reserva ${session.client_reference_id}, PaymentIntent ${intentId}: no se hace nada`,
      );
      return;
    }
    const payment = await this.findSessionPayment(session.id);
    if (!payment) {
      // Pasa si falló el COMMIT de la reserva después de crear la sesión: se cobró algo que no tiene reserva.
      this.logger.error(`Pago de la sesión ${session.id} sin reserva: hay que reembolsarlo a mano`);
      return;
    }

    if (payment.booking.status !== BookingStatus.PENDING) {
      await this.settleNonPending(payment, intentId);
      return;
    }
    if (await this.markPaid(payment, intentId)) {
      await this.confirm(payment.bookingId);
      return;
    }
    // Perdió la carrera: otro cambio ganó entre la lectura y la transición. Se decide con el estado que quedó.
    const current = await this.findSessionPayment(session.id);
    if (!current || current.booking.status === BookingStatus.PENDING) {
      throw new ConflictException('La reserva cambió de estado mientras se procesaba el pago');
    }
    await this.settleNonPending(current, intentId);
  }

  /** `PENDING → PAID` y el pago a `SUCCEEDED` en una transacción. Devuelve `false` si otro cambio ganó (409). */
  private async markPaid(payment: SessionPayment, intentId: string | null): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.state.transition(
          payment.bookingId,
          BookingStatus.PAID,
          { actorId: null, reason: PAID_REASON },
          tx,
        );
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCEEDED, stripePaymentIntentId: intentId },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof ConflictException) return false;
      throw error;
    }
  }

  /** El pago ya quedó registrado: un error de la validación no debe hacer que Stripe reintente. */
  private async confirm(bookingId: string): Promise<void> {
    try {
      await this.confirmation.confirm(bookingId);
    } catch (error) {
      this.logger.error(`Reserva ${bookingId} pagada, pero falló su confirmación: ${errorName(error)}`);
    }
  }

  /** Lo que corresponde a un pago que llega cuando la reserva ya no está `PENDING`. */
  private async settleNonPending(payment: SessionPayment, intentId: string | null): Promise<void> {
    const { status } = payment.booking;
    if (status === BookingStatus.EXPIRED || status === BookingStatus.CANCELLED) {
      await this.refundLatePayment(payment, status, intentId);
    } else if (status === BookingStatus.PAID) {
      // Un reenvío repara una caída entre el COMMIT y `confirm`. Por eso `confirm` tiene que ser idempotente.
      await this.confirm(payment.bookingId);
    }
    // CONFIRMED o FINISHED: el pago ya se procesó y el evento está repetido.
  }

  /**
   * Se cobró una reserva que ya no sigue en pie (enmienda a P-06): se devuelve el total y la reserva no revive. Si el
   * reembolso falla, el error llega a la respuesta para que Stripe reintente.
   */
  private async refundLatePayment(
    payment: SessionPayment,
    status: BookingStatus,
    intentId: string | null,
  ): Promise<void> {
    if (payment.status === PaymentStatus.REFUNDED) return;

    if (payment.status === PaymentStatus.SUCCEEDED) {
      // Pago ya registrado. Es un reintento, salvo que la reserva haya llegado a estar pagada y se cancelara después:
      // entonces el reembolso ya lo decidió la política de cancelación (P-14), que puede ser «sin reembolso».
      const wasPaid = await this.prisma.bookingEvent.count({
        where: { bookingId: payment.bookingId, toStatus: BookingStatus.PAID },
      });
      if (wasPaid > 0) {
        this.logger.warn(`Evento de pago repetido sobre la reserva ${payment.bookingId}, cancelada después de pagarse: no se reembolsa`);
        return;
      }
    } else {
      // Condicionado: un evento repetido al mismo tiempo pudo dejarlo ya reembolsado.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
        data: { status: PaymentStatus.SUCCEEDED, stripePaymentIntentId: intentId },
      });
    }

    try {
      await this.refunder.refundBooking(
        payment.bookingId,
        payment.amount,
        `Sistema: se recibió el pago de una reserva ${status}`,
      );
    } catch (error) {
      this.logger.error(`No se pudo reembolsar el pago de la reserva ${payment.bookingId}: ${errorName(error)}`);
      // Un error nuevo: Nest registra el mensaje de lo que no sea una HttpException, y el del proveedor puede traer datos.
      throw new InternalServerErrorException('No se pudo reembolsar el pago');
    }
  }

  /** La sesión venció sin pagarse: el pago a `FAILED` y, si sigue `PENDING`, la reserva a `EXPIRED`. */
  private async onSessionExpired(sessionId: string): Promise<void> {
    const payment = await this.findSessionPayment(sessionId);
    // Una sesión sin reserva vence igual (falló el COMMIT de `create`); no se cobró nada.
    if (!payment) {
      this.logger.warn(`Sesión ${sessionId} vencida sin pago registrado: no se hace nada`);
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
      if (payment.booking.status !== BookingStatus.PENDING) return;
      try {
        await this.state.transition(
          payment.bookingId,
          BookingStatus.EXPIRED,
          { actorId: null, reason: EXPIRED_REASON },
          tx,
        );
      } catch (error) {
        // El 409 se lanza antes de escribir, así que la transacción sigue sirviendo: otro cambio ganó, y no se toca.
        if (!(error instanceof ConflictException)) throw error;
      }
    });
  }

  /** Los pagos de las reservas donde soy el arrendatario, los creados más recientemente primero. */
  async findMine(userId: string, { page, pageSize }: PageQueryDto): Promise<PaymentsPageDto> {
    const where = { booking: { renterId: userId } };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { booking: { select: { space: { select: { name: true } } } } },
        // El id desempata dos pagos creados en el mismo milisegundo, así las páginas no se cruzan.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    const items = payments.map((payment) => ({
      id: payment.id,
      bookingId: payment.bookingId,
      spaceName: payment.booking.space.name,
      amount: payment.amount,
      fee: payment.fee,
      refundedAmount: payment.refundedAmount,
      status: payment.status,
      createdAt: payment.createdAt,
    }));
    return { items, total, page, pageSize };
  }
}

/** La sesión trae el id del PaymentIntent o, si se pidió expandido, el objeto. */
function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  return typeof intent === 'string' ? intent : (intent?.id ?? null);
}

/** Solo el nombre: el mensaje de un error del proveedor puede traer datos del pago. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'error';
}
