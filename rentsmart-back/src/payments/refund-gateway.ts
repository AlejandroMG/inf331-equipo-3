import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { describeStripeError } from './stripe-checkout.gateway';

/** Lo que el proveedor necesita para devolver parte o todo un pago. Montos en CLP enteros. */
export interface RefundRequest {
  paymentId: string;
  paymentIntentId: string;
  amount: number;
  /** Lo ya devuelto de este pago: forma parte de la clave de idempotencia. */
  alreadyRefunded: number;
}

/**
 * Puerto de bajo nivel de los reembolsos: solo habla con el proveedor. El que decide si corresponde y actualiza
 * `Payment` es `PaymentRefundService`. Lanza un error si no se pudo devolver el dinero.
 */
export interface RefundGateway {
  refund(request: RefundRequest): Promise<void>;
}

/** Token de inyección de `RefundGateway`. */
export const REFUND_GATEWAY = Symbol('REFUND_GATEWAY');

/** Lo único que este gateway usa del cliente de Stripe; así los tests le pasan un doble pequeño. */
export type StripeRefundClient = { refunds: Pick<Stripe['refunds'], 'create'> };

/** El código de Stripe para un cargo que ya estaba reembolsado completo. */
export const ALREADY_REFUNDED_CODE = 'charge_already_refunded';

/**
 * Reembolsos con Stripe (PA-03, #47). CLP no tiene decimales en Stripe: el monto va tal cual, sin multiplicar por 100.
 *
 * La clave de idempotencia sale del id del pago, de lo ya devuelto y del monto, así que dos llamadas con el mismo
 * estado del pago mandan la misma clave. Un segundo reembolso parcial lleva otra; con una que dependiera solo del pago,
 * Stripe repetiría la respuesta del primero sin devolver nada. La misma clave no garantiza que las dos llamadas
 * terminen bien: si la primera sigue en curso, Stripe puede rechazar la otra con `idempotency_key_in_use`, y ese error
 * se propaga si persiste después del reintento del SDK. Tampoco sirve para reintentar un fallo: la respuesta guardada,
 * también la de un error, se puede repetir mientras la clave siga vigente.
 *
 * `succeeded` y `pending` cuentan como aceptados. Cualquier otro estado lanza un error, para que el pago no quede
 * `REFUNDED`: `failed`, `canceled` y `requires_action`, que no aplica a tarjetas y pide una acción que aquí nadie hace.
 * Limitación: un `pending` puede fallar después (evento `refund.failed`); esta historia no lo escucha.
 */
export class StripeRefundGateway implements RefundGateway {
  private readonly logger = new Logger(StripeRefundGateway.name);

  constructor(private readonly stripe: StripeRefundClient) {}

  async refund({ paymentId, paymentIntentId, amount, alreadyRefunded }: RefundRequest): Promise<void> {
    let refund: Awaited<ReturnType<StripeRefundClient['refunds']['create']>>;
    try {
      refund = await this.stripe.refunds.create(
        { payment_intent: paymentIntentId, amount },
        { idempotencyKey: `refund-${paymentId}-${alreadyRefunded}-${amount}` },
      );
    } catch (error) {
      // El dinero ya se devolvió: por ejemplo, Stripe reembolsó pero se cayó la actualización del pago.
      if ((error as { code?: unknown } | null)?.code === ALREADY_REFUNDED_CODE) return;
      this.logger.error(`Stripe no reembolsó ${amount} CLP del pago ${paymentId}, o no lo confirmó: ${describeStripeError(error)}`);
      throw error;
    }
    if (refund.status !== 'succeeded' && refund.status !== 'pending') {
      const message = `Stripe no reembolsó ${amount} CLP del pago ${paymentId}: el reembolso ${refund.id} quedó en estado ${String(refund.status)}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }
}

/**
 * Sin cliente de Stripe (desarrollo sin claves, CI, e2e) no hay a quién pedirle el reembolso. Una reserva hecha sin
 * Stripe no tiene `Payment`, así que `PaymentRefundService` nunca llega aquí. Si llega, los datos están inconsistentes:
 * rechaza, porque responder como si nada dejaría el pago en `REFUNDED` sin haber devuelto el dinero.
 */
export class NoopRefundGateway implements RefundGateway {
  refund({ paymentId }: RefundRequest): Promise<void> {
    return Promise.reject(new Error(`No hay cliente de Stripe para reembolsar el pago ${paymentId}`));
  }
}
