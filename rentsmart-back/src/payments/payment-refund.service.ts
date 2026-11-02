import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRefunder } from './payment-refunder';
import { REFUND_GATEWAY, type RefundGateway } from './refund-gateway';

/**
 * El proveedor reembolsó, pero `Payment` no se pudo actualizar: el dinero ya se devolvió y la base dice lo contrario.
 * `PaymentRefundService` ya dejó en el log cómo repararlo; el mensaje solo lleva ids, montos y estados.
 */
export class RefundNotRecordedError extends Error {
  override readonly name = 'RefundNotRecordedError';
}

/**
 * Reembolsa el pago de una reserva (PA-03, #47). Lo usa cancelar (P-14) y, desde sus historias, el webhook (PA-02) y la
 * validación automática (RE-04). Quien llama decide el monto; aquí solo se comprueba que el pago lo admita.
 *
 * Llama al proveedor fuera de cualquier transacción, para no retener una conexión de la base mientras responde.
 */
@Injectable()
export class PaymentRefundService implements PaymentRefunder {
  private readonly logger = new Logger(PaymentRefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REFUND_GATEWAY) private readonly gateway: RefundGateway,
  ) {}

  /**
   * No hace nada si la reserva no tiene pago, si ya está reembolsado o si `amount <= 0`. Lanza un error si el pago no
   * está `SUCCEEDED`, si no tiene PaymentIntent, si el monto excede lo que queda por devolver o si el proveedor falla.
   * Solo devolver el total deja el pago en `REFUNDED`; un parcial actualiza `refundedAmount` y lo deja en `SUCCEEDED`.
   * Si el proveedor reembolsó y falla la escritura, lanza `RefundNotRecordedError`.
   *
   * `reason` queda en el log: no le pases texto escrito por una persona.
   */
  async refundBooking(bookingId: string, amount: number, reason: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      select: { id: true, status: true, amount: true, refundedAmount: true, stripePaymentIntentId: true },
    });
    if (!payment || payment.status === PaymentStatus.REFUNDED || amount <= 0) return;

    const label = `El pago ${payment.id} de la reserva ${bookingId}`;
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw this.inconsistent(`${label} no se puede reembolsar: está en estado ${payment.status}`);
    }
    if (!payment.stripePaymentIntentId) {
      throw this.inconsistent(`${label} no se puede reembolsar: no tiene PaymentIntent`);
    }
    const refundedAmount = payment.refundedAmount + amount;
    if (refundedAmount > payment.amount) {
      throw this.inconsistent(`${label} no admite ${amount} CLP más: quedaría en ${refundedAmount} de ${payment.amount}`);
    }

    await this.gateway.refund({
      paymentId: payment.id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount,
      alreadyRefunded: payment.refundedAmount,
    });

    // Condicionada a lo que se leyó: de dos llamadas simultáneas que pasan por el proveedor escribe una sola, y
    // `refundedAmount` no suma dos veces.
    const status = refundedAmount === payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.SUCCEEDED;
    let count: number;
    try {
      ({ count } = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.SUCCEEDED, refundedAmount: payment.refundedAmount },
        data: { refundedAmount, status },
      }));
    } catch (error) {
      const message = `Stripe reembolsó ${amount} CLP del pago ${payment.id} de la reserva ${bookingId}, pero no se pudo registrar en la base. Reparar a mano: refundedAmount=${refundedAmount}, status=${status}`;
      this.logger.error(`${message} (${error instanceof Error ? error.name : 'error'})`);
      throw new RefundNotRecordedError(message);
    }
    if (count === 0) {
      this.logger.warn(`${label} cambió mientras se reembolsaba; no se actualizó de nuevo`);
      return;
    }
    this.logger.log(`Reembolso de ${amount} CLP del pago ${payment.id} de la reserva ${bookingId}: ${reason}`);
  }

  /** El mensaje solo lleva ids, estados y montos, así que se puede registrar completo. */
  private inconsistent(message: string): Error {
    this.logger.error(message);
    return new Error(message);
  }
}
