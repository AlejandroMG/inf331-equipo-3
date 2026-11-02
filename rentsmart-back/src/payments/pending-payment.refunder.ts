import { Injectable, Logger } from '@nestjs/common';
import { PaymentRefunder } from './payment-refunder';

/**
 * Reembolso provisorio, hasta integrar `RefundsModule` de PA-03 (#47). No reembolsa nada: avisa que hay que hacerlo a
 * mano y lanza un error, para que el webhook responda 500 y Stripe reintente, en vez de dar por devuelto un pago.
 */
@Injectable()
export class PendingPaymentRefunder implements PaymentRefunder {
  private readonly logger = new Logger(PendingPaymentRefunder.name);

  refundBooking(bookingId: string, amount: number, _reason: string): Promise<void> {
    this.logger.error(`Reembolso manual pendiente: reserva ${bookingId}, ${amount} CLP (PA-03 todavía no está integrada)`);
    return Promise.reject(new Error('El reembolso automático todavía no está disponible (PA-03)'));
  }
}
